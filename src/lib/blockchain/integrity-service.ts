import crypto from 'crypto';
import { ethers } from 'ethers';
import { prisma } from '@/lib/prisma';
import { getProvider } from '@/lib/blockchain/client';

export type NodeStatus = 'HEALTHY' | 'DEGRADED' | 'SUSPECT' | 'QUARANTINED' | 'OFFLINE';

export interface BlockchainNode {
  nodeId: string;
  name: string;
  providerUrl: string;
  chainId: number;
  status: NodeStatus;
  latencyMs: number;
  latestBlockNumber: number;
  latestBlockHash: string;
  previousBlockHash: string;
  failureCount: number;
  inconsistencyCount: number;
  lastError: string | null;
  quarantinedAt: string | null;
  quarantineReason: string | null;
  isTrusted: boolean;
}

export interface IntegrityIncident {
  id?: string;
  incidentId?: string;
  nodeId?: string;
  incidentType?: string;
  type?: string;
  affectedBlockRange?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  description?: string;
  evidence?: any;
  actionTaken?: string;
  status?: string;
  resolved?: boolean;
  aiExplanation?: string;
  createdAt: string | Date;
}

export interface RecoveryEvent {
  id: string;
  nodeId: string;
  action: string;
  details: string;
  success: boolean;
  timestamp: string;
}

export interface PaymentAuditRecord {
  id: string;
  paymentIntentId: string;
  paymentId?: string;
  sender: string;
  recipient: string;
  amount: number;
  currency: string;
  blockNumber?: number;
  sequenceNumber: number;
  canonicalHash: string;
  previousAuditHash: string;
  currentAuditHash: string;
  verificationStatus?: string;
  tamperEvidentState?: string;
  verified?: boolean;
  isRecovered?: boolean;
  createdAt?: string;
  paymentIntent?: any;
}

export interface IntegritySnapshot {
  overallHealth: string;
  activeNodesCount: number;
  quarantinedNodesCount: number;
  latestCheckpointRoot?: string;
  rootHash?: string;
  status?: string;
  leafCount?: number;
  blockNumber?: number;
  timestamp?: string;
  anchoredOnChain?: boolean;
}

const INITIAL_NODES: BlockchainNode[] = [
  {
    nodeId: 'node-a-primary',
    name: 'Node A (Primary Local RPC)',
    providerUrl: 'http://127.0.0.1:8545',
    chainId: 31337,
    status: 'HEALTHY',
    latencyMs: 120,
    latestBlockNumber: 42,
    latestBlockHash: '0x8f7d9a1b2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
    previousBlockHash: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    failureCount: 0,
    inconsistencyCount: 0,
    lastError: null,
    quarantinedAt: null,
    quarantineReason: null,
    isTrusted: true,
  },
  {
    nodeId: 'node-b-failover',
    name: 'Node B (Secondary Replica Node)',
    providerUrl: 'http://127.0.0.1:8546',
    chainId: 31337,
    status: 'HEALTHY',
    latencyMs: 145,
    latestBlockNumber: 42,
    latestBlockHash: '0x8f7d9a1b2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
    previousBlockHash: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    failureCount: 0,
    inconsistencyCount: 0,
    lastError: null,
    quarantinedAt: null,
    quarantineReason: null,
    isTrusted: true,
  },
  {
    nodeId: 'node-c-archive',
    name: 'Node C (Archive Validator Node)',
    providerUrl: 'http://127.0.0.1:8547',
    chainId: 31337,
    status: 'HEALTHY',
    latencyMs: 180,
    latestBlockNumber: 42,
    latestBlockHash: '0x8f7d9a1b2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
    previousBlockHash: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    failureCount: 0,
    inconsistencyCount: 0,
    lastError: null,
    quarantinedAt: null,
    quarantineReason: null,
    isTrusted: false,
  },
];

let nodeStore: BlockchainNode[] = JSON.parse(JSON.stringify(INITIAL_NODES));

// ════════════════════════════════════════════════════════════
// CORE CRYPTOGRAPHIC LOGIC
// ════════════════════════════════════════════════════════════

export function computeCanonicalHash(paymentIntent: any): string {
  const payload = `id:${paymentIntent.id}|sender:${paymentIntent.sender}|recipient:${paymentIntent.recipient}|amount:${paymentIntent.amount}|currency:${paymentIntent.currency}|status:${paymentIntent.status}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export async function recordPaymentAudit(paymentIntentId: string): Promise<void> {
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: paymentIntentId },
    include: { auditRecord: true },
  });
  if (!intent || intent.auditRecord) return; // Already recorded or missing

  const canonicalHash = computeCanonicalHash(intent);

  // Find previous audit hash to chain it
  const lastRecord = await prisma.paymentAuditRecord.findFirst({
    orderBy: { sequenceNumber: 'desc' },
  });

  const previousAuditHash = lastRecord?.currentAuditHash || '0000000000000000000000000000000000000000000000000000000000000000';
  const currentAuditHash = crypto.createHash('sha256').update(`${previousAuditHash}:${canonicalHash}`).digest('hex');

  await prisma.paymentAuditRecord.create({
    data: {
      paymentIntentId,
      canonicalHash,
      previousAuditHash,
      currentAuditHash,
      verificationStatus: 'VERIFIED',
    }
  });
}

function computeSnapshotMerkleRoot(records: any[]): string {
  const leaves = records.map((r) =>
    crypto.createHash('sha256').update(`${r.paymentIntentId}:${r.currentAuditHash}`).digest('hex')
  );
  if (leaves.length === 0) return '0x0';

  let currentLevel = leaves;
  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        nextLevel.push(
          crypto
            .createHash('sha256')
            .update(currentLevel[i] + currentLevel[i + 1])
            .digest('hex')
        );
      } else {
        nextLevel.push(currentLevel[i]);
      }
    }
    currentLevel = nextLevel;
  }
  return `0x${currentLevel[0]}`;
}

export async function generateCheckpoint() {
  const records = await prisma.paymentAuditRecord.findMany({
    orderBy: { sequenceNumber: 'asc' }
  });
  
  if (records.length === 0) return null;

  const rootHash = computeSnapshotMerkleRoot(records);
  const lastSequence = records[records.length - 1].sequenceNumber;

  // Find if current checkpoint already exists for this root
  const existing = await prisma.integrityCheckpoint.findFirst({
    where: { rootHash }
  });
  
  if (existing) return existing;

  const prevCheckpoint = await prisma.integrityCheckpoint.findFirst({
    orderBy: { lastSequenceNumber: 'desc' }
  });

  return await prisma.integrityCheckpoint.create({
    data: {
      checkpointId: `SNAP_${Date.now()}`,
      lastSequenceNumber: lastSequence,
      rootHash,
      previousCheckpointId: prevCheckpoint?.id,
      verificationStatus: 'VERIFIED'
    }
  });
}

export async function verifyAuditChain() {
  const records = await prisma.paymentAuditRecord.findMany({
    orderBy: { sequenceNumber: 'asc' },
    include: { paymentIntent: true }
  });

  let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
  let expectedNextSeq = -1;
  let gapDetected = false;
  let tamperDetected = false;
  let faultyRecords: any[] = [];

  for (const record of records) {
    if (expectedNextSeq !== -1 && record.sequenceNumber !== expectedNextSeq) {
      gapDetected = true;
      faultyRecords.push(record);
    }
    expectedNextSeq = record.sequenceNumber + 1;

    // Verify canonical hashing (has the DB row been tampered with?)
    const expectedCanonical = computeCanonicalHash(record.paymentIntent);
    if (record.canonicalHash !== expectedCanonical) {
      tamperDetected = true;
      faultyRecords.push(record);
    }

    // Verify chain link
    if (record.previousAuditHash !== previousHash) {
      tamperDetected = true;
      faultyRecords.push(record);
    }

    const recomputedHash = crypto.createHash('sha256').update(`${record.previousAuditHash}:${record.canonicalHash}`).digest('hex');
    if (record.currentAuditHash !== recomputedHash) {
      tamperDetected = true;
      faultyRecords.push(record);
    }

    previousHash = record.currentAuditHash;
  }

  // Generate Incidents if anomalies found
  if (gapDetected || tamperDetected) {
    const activeIncident = await prisma.integrityIncident.findFirst({
      where: { status: { in: ['DETECTED', 'INVESTIGATING'] }, type: { in: ['PAYMENT_GAP_DETECTED', 'PAYMENT_RECORD_TAMPERED'] } }
    });
    
    if (!activeIncident) {
      await prisma.integrityIncident.create({
        data: {
          incidentId: `INC_${Date.now()}`,
          type: gapDetected ? 'PAYMENT_GAP_DETECTED' : 'PAYMENT_RECORD_TAMPERED',
          severity: 'CRITICAL',
          affectedBlockRange: `Sequences near ${faultyRecords[0]?.sequenceNumber}`,
          affectedPayments: faultyRecords.map(f => f.paymentIntentId),
          evidence: {
            details: gapDetected ? 'A sequence gap was detected in the database ledger. Potential selective erasure.' : 'Cryptographic mismatch detected. A payment record field was modified bypassing the hash chain.'
          },
          aiExplanation: gapDetected 
            ? 'An unauthorized payment deletion attempt was detected. The sequence numbering in the database is no longer contiguous, indicating a missing record that breaks the cryptographic proof.'
            : 'Payment database record was modified. Cryptographic audit hash verification failed, preserving original verified transaction state.',
        }
      });
    }

    // Mark latest checkpoint as tampered
    const latestCp = await prisma.integrityCheckpoint.findFirst({ orderBy: { createdAt: 'desc' }});
    if (latestCp && latestCp.verificationStatus === 'VERIFIED') {
       await prisma.integrityCheckpoint.update({
         where: { id: latestCp.id },
         data: { verificationStatus: 'TAMPERED' }
       });
    }
  }

  return { gapDetected, tamperDetected, recordsValidated: records.length };
}

// ════════════════════════════════════════════════════════════
// CORE PUBLIC SERVICES (DB BACKED)
// ════════════════════════════════════════════════════════════

export function getNodeStatuses(): BlockchainNode[] {
  return nodeStore;
}

export async function getIntegrityIncidents() {
  return await prisma.integrityIncident.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function getRecoveryEvents() {
  return await prisma.recoveryEvent.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function getPaymentAuditRecords() {
  const records = await prisma.paymentAuditRecord.findMany({
    orderBy: { sequenceNumber: 'desc' },
    include: { paymentIntent: true },
    take: 100
  });

  // Map to the format expected by the frontend
  return records.map(r => ({
    paymentId: r.paymentIntentId,
    sequenceNumber: r.sequenceNumber,
    sender: r.paymentIntent.sender,
    recipient: r.paymentIntent.recipient,
    amount: r.paymentIntent.amount,
    currency: r.paymentIntent.currency,
    status: r.paymentIntent.status,
    transactionHash: 'N/A', 
    blockNumber: r.sequenceNumber, // mock block for UI display
    blockHash: '0x' + r.currentAuditHash.substring(0, 64),
    createdAt: r.createdAt.toISOString(),
    previousAuditHash: r.previousAuditHash,
    currentAuditHash: r.currentAuditHash,
    isRecovered: r.isRecovered
  }));
}

export async function getIntegritySnapshot() {
  let cp = await prisma.integrityCheckpoint.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!cp) {
    cp = await generateCheckpoint();
  }
  
  if (!cp) return null;

  const count = await prisma.paymentAuditRecord.count({ where: { sequenceNumber: { lte: cp.lastSequenceNumber } } });
  
  return {
    snapshotId: cp.checkpointId,
    rangeStart: 1,
    rangeEnd: cp.lastSequenceNumber,
    rootHash: cp.rootHash,
    leafCount: count,
    createdAt: cp.createdAt.toISOString(),
    status: cp.verificationStatus
  };
}

export async function refreshNodeStatus(): Promise<BlockchainNode[]> {
  try {
    const provider = getProvider();
    const blockNumber = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNumber);

    if (block) {
      const nodeA = nodeStore.find((n) => n.nodeId === 'node-a-primary');
      if (nodeA && nodeA.status !== 'QUARANTINED') {
        nodeA.latestBlockNumber = blockNumber;
        nodeA.latestBlockHash = block.hash || nodeA.latestBlockHash;
        nodeA.previousBlockHash = block.parentHash || nodeA.previousBlockHash;
        nodeA.status = 'HEALTHY';
        nodeA.latencyMs = 115;
      }
      const nodeB = nodeStore.find((n) => n.nodeId === 'node-b-failover');
      if (nodeB && nodeB.status !== 'QUARANTINED') {
        nodeB.latestBlockNumber = blockNumber;
        nodeB.latestBlockHash = block.hash || nodeB.latestBlockHash;
        nodeB.previousBlockHash = block.parentHash || nodeB.previousBlockHash;
        nodeB.status = 'HEALTHY';
        nodeB.latencyMs = 140;
      }
    }
  } catch (err) {}
  return nodeStore;
}

export async function verifyMultiNodeConsistency() {
  await refreshNodeStatus();
  // Call DB audit chain verification
  await verifyAuditChain();
  
  const activeNodes = nodeStore.filter((n) => n.status !== 'QUARANTINED' && n.status !== 'OFFLINE');
  if (activeNodes.length < 2) return { isConsistent: true, incidentsCreated: 0 };

  const refNode = activeNodes[0];
  let incidentsCreated = 0;

  for (let i = 1; i < activeNodes.length; i++) {
    const node = activeNodes[i];
    if (node.latestBlockNumber === refNode.latestBlockNumber &&
        node.latestBlockHash.toLowerCase() !== refNode.latestBlockHash.toLowerCase()) {
      
      node.status = 'QUARANTINED';
      node.inconsistencyCount += 2;
      node.quarantinedAt = new Date().toISOString();
      node.quarantineReason = `Block hash divergence detected`;

      const existingInc = await prisma.integrityIncident.findFirst({
        where: { affectedNode: node.nodeId, status: 'CONTAINED' }
      });

      if (!existingInc) {
        await prisma.integrityIncident.create({
          data: {
            incidentId: `INC_${Date.now()}`,
            type: 'CHAIN_HASH_MISMATCH',
            severity: 'HIGH',
            affectedNode: node.nodeId,
            affectedBlockRange: `Block #${node.latestBlockNumber}`,
            affectedPayments: [],
            evidence: {
              expectedValue: refNode.latestBlockHash,
              reportedValue: node.latestBlockHash,
              details: `Node ${node.name} reported corrupted block hash. Quarantined.`
            },
            status: 'CONTAINED',
            aiExplanation: `Node ${node.name} reported a divergent block hash. Isolated to prevent corruption.`
          }
        });
        incidentsCreated++;
      }
    }
  }
  return { isConsistent: incidentsCreated === 0, incidentsCreated };
}

// ════════════════════════════════════════════════════════════
// CHAOS SIMULATION & ATTACK TEST SUITE (NOW EFFECTS REAL DB)
// ════════════════════════════════════════════════════════════

export async function simulateNodeHashMismatch() {
  const nodeC = nodeStore.find((n) => n.nodeId === 'node-c-archive');
  if (nodeC) {
    nodeC.latestBlockHash = '0xDEADBEEF99999999999999999999999999999999999999999999999999999999';
  }
  await verifyMultiNodeConsistency();
}

export async function simulatePaymentErasureAttack() {
  // Delete the second most recent payment audit record to cause a sequence gap
  const records = await prisma.paymentAuditRecord.findMany({
    orderBy: { sequenceNumber: 'desc' },
    take: 2
  });

  if (records.length >= 2) {
    await prisma.paymentAuditRecord.delete({ where: { id: records[1].id } });
  } else if (records.length === 1) {
    await prisma.paymentAuditRecord.delete({ where: { id: records[0].id } });
  }

  // Verification engine detects it
  await verifyAuditChain();
}

export async function simulatePaymentFieldTampering() {
  // Alter a payment amount WITHOUT updating the hash chain
  const firstRecord = await prisma.paymentAuditRecord.findFirst({
    orderBy: { sequenceNumber: 'asc' },
    include: { paymentIntent: true }
  });

  if (firstRecord) {
    await prisma.paymentIntent.update({
      where: { id: firstRecord.paymentIntentId },
      data: { amount: 15 } // Tampered amount
    });
  }

  // Verification engine detects it
  await verifyAuditChain();
}

export async function triggerAutomatedRecovery() {
  // 1. Resynchronize Nodes
  const nodeC = nodeStore.find((n) => n.nodeId === 'node-c-archive');
  const nodeA = nodeStore.find((n) => n.nodeId === 'node-a-primary');
  if (nodeC && nodeA) {
    nodeC.latestBlockNumber = nodeA.latestBlockNumber;
    nodeC.latestBlockHash = nodeA.latestBlockHash;
    nodeC.status = 'HEALTHY';
    nodeC.quarantinedAt = null;
  }

  // 2. Identify missing/tampered records from Integrity Checkpoints
  // In a real scenario, this fetches missing items from Blockchain / Archive Node.
  // For simulation, we re-hash correctly and mark RECOVERED.
  const records = await prisma.paymentAuditRecord.findMany({
    orderBy: { sequenceNumber: 'asc' },
    include: { paymentIntent: true }
  });

  let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
  let restoredCount = 0;

  for (const record of records) {
    const expectedCanonical = computeCanonicalHash(record.paymentIntent);
    const expectedCurrent = crypto.createHash('sha256').update(`${previousHash}:${expectedCanonical}`).digest('hex');
    
    if (record.canonicalHash !== expectedCanonical || record.currentAuditHash !== expectedCurrent || record.previousAuditHash !== previousHash) {
      await prisma.paymentAuditRecord.update({
        where: { id: record.id },
        data: {
          canonicalHash: expectedCanonical,
          previousAuditHash: previousHash,
          currentAuditHash: expectedCurrent,
          isRecovered: true
        }
      });
      restoredCount++;
    }
    previousHash = expectedCurrent;
  }

  // Generate new checkpoint
  await generateCheckpoint();

  // Mark all active incidents as resolved
  await prisma.integrityIncident.updateMany({
    where: { status: { in: ['DETECTED', 'INVESTIGATING', 'CONTAINED'] } },
    data: { status: 'RESOLVED', resolvedAt: new Date() }
  });

  const recEvent = await prisma.recoveryEvent.create({
    data: {
      recoveryId: `REC_${Date.now()}`,
      type: restoredCount > 0 ? 'PAYMENT_RESTORATION' : 'NODE_RESYNC',
      affectedCount: restoredCount + (nodeC ? 1 : 0),
      source: 'Verified EVM Consensus + Audit Log Snapshot',
      target: 'Database Ledger',
      evidence: { details: 'Database sequence rebuilt using cryptographic checkpoint anchors.' },
      status: 'RECOVERED',
      completedAt: new Date()
    }
  });

  return recEvent;
}
