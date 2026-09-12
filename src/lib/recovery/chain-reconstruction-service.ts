import { calculateCanonicalBlockHash, sha256Hex } from '@/lib/crypto/canonical-hash';
import { BlockchainWriteService } from '@/lib/blockchain/blockchain-write-service';
import { ethers } from 'ethers';

export interface ReconstructedBlock {
  id: string;
  applicationTransactionId: string;
  userId: string;
  sender: string;
  receiver: string;
  amount: number;
  currency: string;
  asset: string;
  type: string;
  status: string;
  date: string;
  createdAt: string;
  confirmedAt: string;
  description: string;
  idempotencyKey: string;
  canonicalPayload?: string;
  transactionHash: string;
  hash: string;
  previousHash: string;
  chainRoot: string;
  blockNumber: number;
  walletAddress: string;
  senderPublicKey?: string;
  digitalSignature?: string;
  signature?: string;
  payload?: any;
  verifiedAt: string;
}

export interface ChainReconstructionResult {
  success: boolean;
  reconstructedBlocks: ReconstructedBlock[];
  rejectedBlocks: any[];
  latestBlockNumber: number;
  latestBlockHash: string;
  recoveredChainRoot: string;
  genesisHash: string;
  error?: string;
}

export class ChainReconstructionService {
  private static EXPECTED_GENESIS_SEED = 'genesis:securechainpay:global:v1';

  /**
   * Deterministically reconstructs the canonical blockchain from Genesis #0.
   * Every block is verified cryptographically.
   */
  public static async reconstructChain(candidateBlocks: any[]): Promise<ChainReconstructionResult> {
    const expectedGenesisHash = await sha256Hex(this.EXPECTED_GENESIS_SEED);
    const reconstructedBlocks: ReconstructedBlock[] = [];
    const rejectedBlocks: any[] = [];

    // Sort ascending by blockNumber
    const sorted = [...candidateBlocks].sort((a, b) => (a.blockNumber ?? 0) - (b.blockNumber ?? 0));

    // 1. Genesis Block #0 Rebuild
    const rawGenesis = sorted.find((b) => (b.blockNumber ?? 0) === 0 || b.type === 'genesis');
    if (!rawGenesis) {
      return {
        success: false,
        reconstructedBlocks: [],
        rejectedBlocks: sorted,
        latestBlockNumber: 0,
        latestBlockHash: '',
        recoveredChainRoot: '',
        genesisHash: expectedGenesisHash,
        error: 'GENESIS_NOT_FOUND: Cannot reconstruct chain without Genesis #0.',
      };
    }

    const genesisTime = rawGenesis.createdAt || rawGenesis.date || '1970-01-01T00:00:00.000Z';
    const genesisChainRoot = BlockchainWriteService.GENESIS_CHAIN_ROOT;

    const reconstructedGenesis: ReconstructedBlock = {
      id: 'GENESIS',
      applicationTransactionId: 'TX_GENESIS_GLOBAL',
      userId: 'SYSTEM',
      sender: '0x0000000000000000000000000000000000000000',
      receiver: '0x0000000000000000000000000000000000000000',
      blockNumber: 0,
      hash: expectedGenesisHash,
      transactionHash: expectedGenesisHash,
      previousHash: '0',
      chainRoot: genesisChainRoot,
      walletAddress: '0x0000000000000000000000000000000000000000',
      senderPublicKey: 'SYSTEM_GENESIS',
      digitalSignature: 'Genesis Block - System Generated',
      signature: 'Genesis Block - System Generated',
      type: 'genesis',
      amount: 0,
      currency: 'HSCT',
      asset: 'HSCT',
      status: 'CONFIRMED',
      date: genesisTime,
      createdAt: genesisTime,
      confirmedAt: genesisTime,
      description: 'SecureChain Pay — Global Genesis Block',
      idempotencyKey: 'GENESIS_GLOBAL_KEY',
      payload: rawGenesis.payload || { message: 'SecureChain Global Blockchain Initialized' },
      verifiedAt: new Date().toISOString(),
    };

    reconstructedBlocks.push(reconstructedGenesis);

    let currentPreviousHash = expectedGenesisHash;
    let currentChainRoot = genesisChainRoot;
    let currentBlockNumber = 0;

    // 2. Iterate through subsequent blocks
    const nonGenesis = sorted.filter((b) => (b.blockNumber ?? 0) > 0 && b.type !== 'genesis');

    for (const rawBlock of nonGenesis) {
      const bn = Number(rawBlock.blockNumber ?? 0);

      // Check 1: Sequence continuity
      if (bn !== currentBlockNumber + 1) {
        console.warn(`[ChainReconstructionService] Sequence gap at block #${bn} (expected #${currentBlockNumber + 1}). Rejecting block.`);
        rejectedBlocks.push({ ...rawBlock, rejectionReason: 'SEQUENCE_GAP' });
        break; // Stop at first sequence break
      }

      // Check 2: Previous hash continuity
      const prevHash = (rawBlock.previousHash || '').toLowerCase();
      if (prevHash !== currentPreviousHash.toLowerCase()) {
        console.warn(`[ChainReconstructionService] Broken previousHash at block #${bn}. Stored: ${prevHash}, Expected: ${currentPreviousHash}. Rejecting block.`);
        rejectedBlocks.push({ ...rawBlock, rejectionReason: 'PREVIOUS_HASH_MISMATCH' });
        break;
      }

      // Check 3: Canonical block hash recalculation
      const amount = Number(rawBlock.amount || 0);
      const currency = (rawBlock.currency || rawBlock.asset || 'HSCT').toUpperCase().trim();
      const date = rawBlock.date || rawBlock.createdAt || new Date().toISOString();
      const type = rawBlock.type || 'transfer';
      const idempotencyKey = rawBlock.idempotencyKey || rawBlock.id;

      let recomputedHash = '';
      try {
        recomputedHash = await calculateCanonicalBlockHash({
          blockNumber: bn,
          previousHash: currentPreviousHash,
          sender: rawBlock.sender,
          receiver: rawBlock.receiver,
          amount,
          currency,
          date,
          type,
          idempotencyKey,
        });
      } catch (calcErr: any) {
        rejectedBlocks.push({ ...rawBlock, rejectionReason: `HASH_CALCULATION_ERROR: ${calcErr.message}` });
        break;
      }

      const storedHash = (rawBlock.hash || rawBlock.transactionHash || '').toLowerCase();
      if (storedHash !== recomputedHash.toLowerCase()) {
        console.warn(`[ChainReconstructionService] Hash tampering detected at block #${bn}. Stored: ${storedHash}, Computed: ${recomputedHash}. Rejecting block.`);
        rejectedBlocks.push({ ...rawBlock, rejectionReason: 'BLOCK_HASH_TAMPERED' });
        break;
      }

      // Check 4: Signature verification if present
      if (rawBlock.signature && rawBlock.canonicalPayload && rawBlock.sender) {
        try {
          const recovered = ethers.verifyMessage(rawBlock.canonicalPayload, rawBlock.signature);
          if (recovered.toLowerCase() !== rawBlock.sender.toLowerCase()) {
            console.warn(`[ChainReconstructionService] Signature mismatch on block #${bn}. Rejecting block.`);
            rejectedBlocks.push({ ...rawBlock, rejectionReason: 'SIGNATURE_INVALID' });
            break;
          }
        } catch (sigErr: any) {
          rejectedBlocks.push({ ...rawBlock, rejectionReason: `SIGNATURE_VERIFICATION_FAILED: ${sigErr.message}` });
          break;
        }
      }

      // Recalculate rolling chainRoot
      const nextChainRoot = BlockchainWriteService.computeChainRoot(currentChainRoot, recomputedHash);

      const verifiedBlock: ReconstructedBlock = {
        id: rawBlock.id || rawBlock.applicationTransactionId || `BLOCK_${bn}`,
        applicationTransactionId: rawBlock.applicationTransactionId || rawBlock.id || `TX_${bn}`,
        userId: rawBlock.userId || 'SYSTEM',
        sender: rawBlock.sender,
        receiver: rawBlock.receiver,
        amount,
        currency,
        asset: currency,
        type,
        status: 'CONFIRMED',
        date,
        createdAt: rawBlock.createdAt || date,
        confirmedAt: rawBlock.confirmedAt || date,
        description: rawBlock.description || `${type.toUpperCase()}: ${amount} ${currency}`,
        idempotencyKey,
        canonicalPayload: rawBlock.canonicalPayload,
        transactionHash: recomputedHash,
        hash: recomputedHash,
        previousHash: currentPreviousHash,
        chainRoot: nextChainRoot,
        blockNumber: bn,
        walletAddress: rawBlock.walletAddress || rawBlock.sender,
        senderPublicKey: rawBlock.senderPublicKey,
        digitalSignature: rawBlock.digitalSignature || rawBlock.signature,
        signature: rawBlock.signature,
        payload: rawBlock.payload,
        verifiedAt: new Date().toISOString(),
      };

      reconstructedBlocks.push(verifiedBlock);
      currentPreviousHash = recomputedHash;
      currentChainRoot = nextChainRoot;
      currentBlockNumber = bn;
    }

    return {
      success: true,
      reconstructedBlocks,
      rejectedBlocks,
      latestBlockNumber: currentBlockNumber,
      latestBlockHash: currentPreviousHash,
      recoveredChainRoot: currentChainRoot,
      genesisHash: expectedGenesisHash,
    };
  }
}
