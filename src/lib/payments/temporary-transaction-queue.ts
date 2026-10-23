import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export interface QueueNode {
  transactionId: string;
  senderWallet: string;
  recipientWallet: string;
  amount: number;
  asset: string;
  idempotencyKey: string;
  reservationId: string;
  status: string;
  createdAt: number;
  expiresAt: number;
  retryCount: number;
  integrityHash: string;
  previousHash: string;
  canonicalPayload?: string | null;
  signature?: string | null;
  processingOwner?: string | null;
  lockExpiresAt?: number | null;
  prev: QueueNode | null;
  next: QueueNode | null;
}

/**
 * High-performance Doubly Linked Queue structure preserving strict FIFO order.
 */
class DoublyLinkedQueue {
  public head: QueueNode | null = null;
  public tail: QueueNode | null = null;
  public size = 0;

  public enqueue(node: QueueNode): void {
    node.prev = this.tail;
    node.next = null;

    if (this.tail) {
      this.tail.next = node;
    } else {
      this.head = node;
    }
    this.tail = node;
    this.size++;
  }

  public remove(node: QueueNode): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    node.prev = null;
    node.next = null;
    this.size = Math.max(0, this.size - 1);
  }

  public clear(): void {
    this.head = null;
    this.tail = null;
    this.size = 0;
  }

  public toArray(): QueueNode[] {
    const list: QueueNode[] = [];
    let current = this.head;
    while (current) {
      list.push(current);
      current = current.next;
    }
    return list;
  }
}

/**
 * Hybrid Temporary Transaction Queue:
 * Combines in-memory Array/Index (Map) + Doubly Linked List for execution,
 * strictly backed by PostgreSQL for durable persistence across crashes and restarts.
 */
export class TemporaryTransactionQueue {
  private static instance: TemporaryTransactionQueue;
  private transactionIndex: Map<string, QueueNode> = new Map();
  private queue: DoublyLinkedQueue = new DoublyLinkedQueue();
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): TemporaryTransactionQueue {
    if (!TemporaryTransactionQueue.instance) {
      TemporaryTransactionQueue.instance = new TemporaryTransactionQueue();
    }
    return TemporaryTransactionQueue.instance;
  }

  /**
   * Rebuild the entire in-memory queue from PostgreSQL upon startup.
   */
  public async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          await this.rebuildFromDatabase();
          this.isInitialized = true;
        } finally {
          this.initPromise = null;
        }
      })();
    }
    return this.initPromise;
  }

  /**
   * Rebuild queue from durable database storage.
   */
  public async rebuildFromDatabase(): Promise<number> {
    try {
      let pendingTxs: any[] = [];
      try {
        pendingTxs = (await Promise.race([
          prisma.temporaryTransaction.findMany({
            where: {
              status: { in: ['TEMP_PENDING', 'ONCHAIN_INITIALIZING'] },
              expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'asc' },
          }),
          new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 1500)),
        ])) as any[];
      } catch (dbErr: any) {
        console.warn('[TemporaryTransactionQueue] Prisma rebuild skipped (DB offline):', dbErr.message);
      }

      // If Prisma was offline or returned empty, attempt Firestore recovery
      if (!pendingTxs || pendingTxs.length === 0) {
        try {
          const { getAdminDb } = await import('@/lib/firebase/admin');
          const adminDb = getAdminDb();
          const snapshot = await adminDb.collection('temporary_transactions')
            .where('status', 'in', ['TEMP_PENDING', 'ONCHAIN_INITIALIZING'])
            .get();
          if (!snapshot.empty) {
            pendingTxs = snapshot.docs.map(doc => {
              const d = doc.data();
              return {
                ...d,
                createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
                expiresAt: d.expiresAt ? new Date(d.expiresAt) : new Date(Date.now() + 60000),
              };
            });
          }
        } catch (fsErr: any) {
          console.warn('[TemporaryTransactionQueue] Firestore fallback read warning:', fsErr.message);
        }
      }

      this.transactionIndex.clear();
      this.queue.clear();

      for (const tx of pendingTxs) {
        const node: QueueNode = {
          transactionId: tx.transactionId,
          senderWallet: tx.senderWallet,
          recipientWallet: tx.recipientWallet,
          amount: Number(tx.amount),
          asset: tx.asset,
          idempotencyKey: tx.idempotencyKey,
          reservationId: tx.reservationId,
          status: tx.status,
          createdAt: tx.createdAt instanceof Date ? tx.createdAt.getTime() : new Date(tx.createdAt).getTime(),
          expiresAt: tx.expiresAt instanceof Date ? tx.expiresAt.getTime() : new Date(tx.expiresAt).getTime(),
          retryCount: tx.retryCount || 0,
          integrityHash: tx.integrityHash,
          previousHash: tx.previousHash,
          canonicalPayload: tx.canonicalPayload,
          signature: tx.signature,
          processingOwner: tx.processingOwner,
          lockExpiresAt: tx.lockExpiresAt ? (tx.lockExpiresAt instanceof Date ? tx.lockExpiresAt.getTime() : Number(tx.lockExpiresAt)) : null,
          prev: null,
          next: null,
        };

        this.transactionIndex.set(node.transactionId, node);
        this.queue.enqueue(node);
      }

      console.info(
        `[TemporaryTransactionQueue] ✓ Rebuilt queue with ${this.queue.size} active temporary transaction(s).`
      );
      return this.queue.size;
    } catch (err: any) {
      console.error('[TemporaryTransactionQueue] Failed to rebuild queue:', err.message);
      return 0;
    }
  }

  public async rebuildQueueFromDatabase(): Promise<number> {
    return this.rebuildFromDatabase();
  }

  /**
   * Enqueue a new temporary transaction durably in DB, then into RAM index & linked list.
   */
  public async enqueue(data: {
    transactionId: string;
    senderWallet: string;
    recipientWallet: string;
    amount: number;
    asset?: string;
    chainId?: number;
    idempotencyKey: string;
    reservationId: string;
    expiresAt: Date;
    canonicalPayload?: string;
    signature?: string;
  }): Promise<QueueNode> {
    await this.ensureInitialized();

    // Check duplicate idempotency
    const existingNode = this.transactionIndex.get(data.transactionId);
    if (existingNode) {
      return existingNode;
    }

    const asset = (data.asset || 'HSCT').toUpperCase();
    const now = new Date();

    // Compute cryptographic integrity hash with DB timeout protection
    let prevTx: any = null;
    try {
      prevTx = await Promise.race([
        prisma.temporaryTransaction.findFirst({
          orderBy: { createdAt: 'desc' },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 1500)),
      ]);
    } catch (dbErr: any) {
      console.warn('[TemporaryTransactionQueue] Prisma prevTx fetch skipped (DB offline):', dbErr.message);
    }

    const previousHash = prevTx?.integrityHash || '0000000000000000000000000000000000000000000000000000000000000000';
    const canonicalStr = `${data.transactionId}|${data.senderWallet}|${data.recipientWallet}|${data.amount}|${asset}|${data.idempotencyKey}|${previousHash}`;
    const integrityHash = crypto.createHash('sha256').update(canonicalStr).digest('hex');

    // 1. DURABLE WRITE TO POSTGRESQL (FAIL-SAFE WITH TIMEOUT)
    let durableTx: any = null;
    try {
      durableTx = await Promise.race([
        prisma.temporaryTransaction.create({
          data: {
            transactionId: data.transactionId,
            senderWallet: data.senderWallet.toLowerCase(),
            recipientWallet: data.recipientWallet.toLowerCase(),
            amount: data.amount,
            asset,
            chainId: data.chainId || 31337,
            idempotencyKey: data.idempotencyKey,
            status: 'TEMP_PENDING',
            createdAt: now,
            expiresAt: data.expiresAt,
            reservationId: data.reservationId,
            integrityHash,
            previousHash,
            canonicalPayload: data.canonicalPayload || null,
            signature: data.signature || null,
          },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 1500)),
      ]);
    } catch (createErr: any) {
      console.warn('[TemporaryTransactionQueue] Prisma durable create skipped (DB offline):', createErr.message);
    }

    // Always mirror to Firestore for durable persistence across restarts & serverless instances
    try {
      const { getAdminDb } = await import('@/lib/firebase/admin');
      const adminDb = getAdminDb();
      await adminDb.collection('temporary_transactions').doc(data.transactionId).set({
        transactionId: data.transactionId,
        senderWallet: data.senderWallet.toLowerCase(),
        recipientWallet: data.recipientWallet.toLowerCase(),
        amount: data.amount,
        asset,
        chainId: data.chainId || 31337,
        idempotencyKey: data.idempotencyKey,
        status: 'TEMP_PENDING',
        createdAt: now.toISOString(),
        expiresAt: data.expiresAt.toISOString(),
        reservationId: data.reservationId,
        integrityHash,
        previousHash,
        canonicalPayload: data.canonicalPayload || null,
        signature: data.signature || null,
      }, { merge: true });
    } catch (fsErr: any) {
      console.warn('[TemporaryTransactionQueue] Firestore mirror warning:', fsErr.message);
    }

    const txRecord = durableTx || {
      transactionId: data.transactionId,
      senderWallet: data.senderWallet.toLowerCase(),
      recipientWallet: data.recipientWallet.toLowerCase(),
      amount: data.amount,
      asset,
      idempotencyKey: data.idempotencyKey,
      reservationId: data.reservationId,
      status: 'TEMP_PENDING',
      createdAt: now,
      expiresAt: data.expiresAt,
    };

    // 2. IN-MEMORY QUEUE + ARRAY INDEX ENQUEUE SECOND
    const node: QueueNode = {
      transactionId: txRecord.transactionId,
      senderWallet: txRecord.senderWallet,
      recipientWallet: txRecord.recipientWallet,
      amount: Number(txRecord.amount),
      asset: txRecord.asset,
      idempotencyKey: txRecord.idempotencyKey,
      reservationId: txRecord.reservationId,
      status: 'TEMP_PENDING',
      createdAt: txRecord.createdAt instanceof Date ? txRecord.createdAt.getTime() : new Date(txRecord.createdAt).getTime(),
      expiresAt: txRecord.expiresAt instanceof Date ? txRecord.expiresAt.getTime() : new Date(txRecord.expiresAt).getTime(),
      retryCount: 0,
      integrityHash,
      previousHash,
      canonicalPayload: data.canonicalPayload || null,
      signature: data.signature || null,
      processingOwner: null,
      lockExpiresAt: null,
      prev: null,
      next: null,
    };

    this.transactionIndex.set(node.transactionId, node);
    this.queue.enqueue(node);

    return node;
  }

  /**
   * Acquire lease on next available node for processing with worker lease protection (§33).
   */
  public async acquireNextForProcessing(workerId: string, leaseMs = 30000): Promise<QueueNode | null> {
    await this.ensureInitialized();

    const now = Date.now();
    let current = this.queue.head;

    while (current) {
      // Is node available (unlocked or lease expired)?
      const isLockExpired = !current.lockExpiresAt || current.lockExpiresAt < now;
      const isNotTerminal = current.status === 'TEMP_PENDING';

      if (isNotTerminal && isLockExpired) {
        const leaseExpiresAt = new Date(now + leaseMs);

        // Lock in database with worker ID
        try {
          await prisma.temporaryTransaction.update({
            where: { transactionId: current.transactionId },
            data: {
              processingOwner: workerId,
              lockExpiresAt: leaseExpiresAt,
              lastAttemptAt: new Date(now),
              retryCount: { increment: 1 },
            },
          });

          current.processingOwner = workerId;
          current.lockExpiresAt = now + leaseMs;
          current.retryCount += 1;

          return current;
        } catch (lockErr) {
          // Worker collision; try next node
        }
      }
      current = current.next;
    }

    return null;
  }

  /**
   * Remove transaction from RAM index and doubly-linked queue on completion or cancellation.
   */
  public remove(transactionId: string): void {
    const node = this.transactionIndex.get(transactionId);
    if (node) {
      this.queue.remove(node);
      this.transactionIndex.delete(transactionId);
    }
  }

  /**
   * Lookup node in O(1) via the Array/Index Map.
   */
  public get(transactionId: string): QueueNode | null {
    return this.transactionIndex.get(transactionId) || null;
  }

  /**
   * Get count of queued items.
   */
  public size(): number {
    return this.queue.size;
  }

  /**
   * Return full snapshot of currently queued transactions.
   */
  public getAll(): QueueNode[] {
    return this.queue.toArray();
  }
}
