import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { computeCanonicalHash } from '@/lib/blockchain/integrity-service';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paymentIntentId } = await params;
    if (!paymentIntentId) {
      return NextResponse.json({ success: false, error: 'Payment ID is required' }, { status: 400 });
    }

    const auditRecord = await prisma.paymentAuditRecord.findUnique({
      where: { paymentIntentId },
      include: { paymentIntent: true }
    });

    if (!auditRecord) {
      return NextResponse.json({ success: false, error: 'Cryptographic audit record not found for this payment.' }, { status: 404 });
    }

    // Recalculate hash on the fly to prove integrity
    const computedCanonical = computeCanonicalHash(auditRecord.paymentIntent);
    const expectedCurrentHash = crypto.createHash('sha256')
      .update(`${auditRecord.previousAuditHash}:${computedCanonical}`)
      .digest('hex');

    const isValid = (auditRecord.canonicalHash === computedCanonical) && 
                    (auditRecord.currentAuditHash === expectedCurrentHash);

    // Find if this was included in a checkpoint
    const checkpoint = await prisma.integrityCheckpoint.findFirst({
      where: {
        lastSequenceNumber: { gte: auditRecord.sequenceNumber }
      },
      orderBy: { lastSequenceNumber: 'asc' }
    });

    return NextResponse.json({
      success: true,
      integrityProof: {
        paymentIntentId,
        sequenceNumber: auditRecord.sequenceNumber,
        isRecovered: auditRecord.isRecovered,
        canonicalHash: {
          stored: auditRecord.canonicalHash,
          computed: computedCanonical,
          matches: auditRecord.canonicalHash === computedCanonical
        },
        hashChain: {
          previousAuditHash: auditRecord.previousAuditHash,
          currentAuditHash: {
            stored: auditRecord.currentAuditHash,
            computed: expectedCurrentHash,
            matches: auditRecord.currentAuditHash === expectedCurrentHash
          }
        },
        checkpointInclusion: checkpoint ? {
          checkpointId: checkpoint.checkpointId,
          rootHash: checkpoint.rootHash,
          verificationStatus: checkpoint.verificationStatus
        } : null,
        overallIntegrity: isValid ? 'VERIFIED' : 'TAMPERED'
      }
    });

  } catch (error: any) {
    console.error('[API /api/payments/:id/integrity-proof] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to generate integrity proof.' },
      { status: 500 }
    );
  }
}
