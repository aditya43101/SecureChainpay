import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireAdminUser } from '@/lib/auth/require-admin-user';
import { SecurityAuditLogger } from '@/lib/security/audit-logger';
import { calculateCanonicalBlockHash, sha256Hex } from '@/lib/crypto/canonical-hash';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Enforce Admin Authorization
    let adminUser: any;
    try {
      adminUser = await requireAdminUser(request);
    } catch (authErr: any) {
      await SecurityAuditLogger.log({
        type: 'PRIVILEGE_ESCALATION_ATTEMPT',
        userId: 'UNKNOWN',
        resource: '/api/blockchain/reset',
        action: 'resetBlockchain',
        result: 'DENIED',
        severity: 'CRITICAL',
        metadata: { error: authErr.message },
      });
      return NextResponse.json(
        { success: false, error: authErr.message || 'Unauthorized: Admin access required' },
        { status: authErr.status || 403 }
      );
    }

    const adminDb = getAdminDb();
    
    // 2. Delete existing global_blocks
    const blocksSnap = await adminDb.collection('global_blocks').get();
    const batch = adminDb.batch();
    blocksSnap.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // 3. Initialize fresh global Genesis Block #0 deterministically
    const genesisTimeISO = '1970-01-01T00:00:00.000Z';
    const genesisHash = await sha256Hex('genesis:securechainpay:global:v1');

    const genesisBlock = {
      id: 'GENESIS',
      applicationTransactionId: 'TX_GENESIS_GLOBAL',
      userId: 'SYSTEM',
      sender: '0x0000000000000000000000000000000000000000',
      receiver: '0x0000000000000000000000000000000000000000',
      blockNumber: 0,
      hash: genesisHash,
      transactionHash: genesisHash,
      previousHash: '0',
      walletAddress: '0x0000000000000000000000000000000000000000',
      senderPublicKey: 'SYSTEM_GENESIS',
      digitalSignature: 'Genesis Block - System Generated',
      signature: 'Genesis Block - System Generated',
      type: 'genesis',
      amount: 0,
      currency: 'HSCT',
      asset: 'HSCT',
      status: 'CONFIRMED',
      date: genesisTimeISO,
      createdAt: genesisTimeISO,
      confirmedAt: genesisTimeISO,
      description: 'SecureChain Pay — Global Genesis Block',
      payload: { message: 'SecureChain Global Blockchain Initialized' },
      difficulty: 1,
      nonce: 0,
      blockSize: 256,
    };

    const chainState = {
      lastBlockNumber: 0,
      lastBlockHash: genesisHash,
      genesisHash: genesisHash,
      totalBlocks: 1,
      lastUpdatedAt: new Date().toISOString(),
    };

    await adminDb.collection('global_blocks').doc('GENESIS').set(genesisBlock);
    await adminDb.collection('global_chain_meta').doc('chain_state').set(chainState);

    await SecurityAuditLogger.log({
      type: 'ADMIN_BLOCKCHAIN_RESET',
      userId: adminUser.uid,
      resource: 'global_blocks',
      action: 'reset',
      result: 'COMMITTED',
      severity: 'HIGH',
      metadata: { initiatedBy: adminUser.uid },
    });

    return NextResponse.json({
      success: true,
      message: 'Global chain initialized cleanly with Genesis Block #0',
      genesisBlock,
      chainState,
    });
  } catch (error: any) {
    console.error('[API /api/blockchain/reset] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to reset global chain' },
      { status: 500 }
    );
  }
}
