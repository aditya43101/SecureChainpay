import { prisma } from '../../lib/prisma';
import {
  CollectedEvidenceDraft,
  InvestigationEvidenceDTO,
  StructuredClaim,
  EvidenceVerificationStatus,
  EvidenceRelationship,
} from './types';

export class EvidenceEngine {
  private static instance: EvidenceEngine;

  public static getInstance(): EvidenceEngine {
    if (!EvidenceEngine.instance) {
      EvidenceEngine.instance = new EvidenceEngine();
    }
    return EvidenceEngine.instance;
  }

  /**
   * Persists collected evidence drafts into the database, generating unique evidence numbers
   */
  public async persistEvidence(
    runId: string,
    drafts: CollectedEvidenceDraft[]
  ): Promise<InvestigationEvidenceDTO[]> {
    if (!drafts || drafts.length === 0) return [];

    const existingEvidences = await prisma.investigationEvidence.findMany({
      where: { runId },
      select: { sourceRecordId: true },
    });
    const results: InvestigationEvidenceDTO[] = [];

    // Deduplicate by sourceRecordId within run to prevent double-counting
    const seen = new Set<string>(existingEvidences.map((e) => e.sourceRecordId));

    for (let i = 0; i < drafts.length; i++) {
      const draft = drafts[i];
      const dedupKey = draft.sourceRecordId;
      if (seen.has(dedupKey)) {
        continue; // Prevent duplicate evidence inflation
      }
      seen.add(dedupKey);

      const seq = existingEvidences.length + results.length + 1;
      const rand = Math.floor(1000 + Math.random() * 9000);
      const timestampSlice = Date.now().toString().slice(-6);
      const evidenceNumber = `EVD-2026-${timestampSlice}-${seq.toString().padStart(3, '0')}-${rand}`;

      const created = await prisma.investigationEvidence.create({
        data: {
          evidenceNumber,
          runId,
          evidenceType: draft.evidenceType,
          sourceRecordId: draft.sourceRecordId,
          contentHash: draft.contentHash || null,
          verificationStatus: draft.verificationStatus,
          description: draft.description,
          limitations: draft.limitations || null,
          relationship: draft.relationship,
          provenanceJson: draft.provenance ? JSON.stringify(draft.provenance) : null,
        },
      });

      results.push({
        id: created.id,
        evidenceNumber: created.evidenceNumber,
        evidenceType: created.evidenceType,
        sourceRecordId: created.sourceRecordId,
        contentHash: created.contentHash,
        verificationStatus: created.verificationStatus as EvidenceVerificationStatus,
        description: created.description,
        limitations: created.limitations,
        relationship: created.relationship as EvidenceRelationship,
        provenance: draft.provenance,
        createdAt: created.createdAt.toISOString(),
      });
    }

    return results;
  }

  /**
   * Analyzes persisted evidence and synthesizes structured claims, verified facts, and contradictions
   */
  public synthesizeClaims(evidenceList: InvestigationEvidenceDTO[]): {
    verifiedFacts: StructuredClaim[];
    observations: StructuredClaim[];
    contradictions: string[];
    unknowns: string[];
  } {
    const verifiedFacts: StructuredClaim[] = [];
    const observations: StructuredClaim[] = [];
    const contradictions: string[] = [];
    const unknowns: string[] = [];

    for (const ev of evidenceList) {
      if (ev.verificationStatus === 'VERIFIED') {
        verifiedFacts.push({
          claim: ev.description,
          claimType: 'VERIFIED_FACT',
          evidenceRefs: [ev.evidenceNumber],
          supportingObservations: [
            ev.contentHash ? `Cryptographic hash commitment: ${ev.contentHash.slice(0, 16)}...` : 'Verified database entity',
          ],
          contradictingObservations: [],
          assessment: 'High confidence verified record backed by cryptographic proof or authoritative genesis certificate.',
          limitations: ev.limitations || undefined,
        });
      } else if (ev.verificationStatus === 'MISMATCH' || ev.relationship === 'CONTRADICTING') {
        contradictions.push(ev.description);
        observations.push({
          claim: ev.description,
          claimType: 'CONTRADICTION',
          evidenceRefs: [ev.evidenceNumber],
          supportingObservations: [],
          contradictingObservations: [ev.description],
          assessment: 'Data inconsistency or sequence contradiction requiring authorized human review.',
          limitations: ev.limitations || 'Anomaly detected does not conclusively establish intentional misconduct.',
        });
      } else if (ev.verificationStatus === 'UNAVAILABLE') {
        unknowns.push(`External verification unavailable for ${ev.evidenceType} (ID: ${ev.sourceRecordId})`);
        observations.push({
          claim: ev.description,
          claimType: 'UNKNOWN',
          evidenceRefs: [ev.evidenceNumber],
          supportingObservations: [],
          contradictingObservations: [],
          assessment: 'Verification service or on-chain dependency was temporarily unavailable or unanchored.',
          limitations: 'Technical verification unavailability must not be construed as evidence of tampering.',
        });
      } else {
        observations.push({
          claim: ev.description,
          claimType: 'SOURCE_CLAIM',
          evidenceRefs: [ev.evidenceNumber],
          supportingObservations: ['Recorded in application database without on-chain cryptographic anchor'],
          contradictingObservations: [],
          assessment: 'Unanchored operational record; subject to standard audit procedures.',
        });
      }
    }

    // Check for common automotive unknowns if data is scarce
    if (evidenceList.length < 3) {
      unknowns.push('Limited lifecycle history recorded for this vehicle. Comprehensive service or inspection logs are pending.');
    }

    return {
      verifiedFacts,
      observations,
      contradictions,
      unknowns,
    };
  }
}

export const evidenceEngine = EvidenceEngine.getInstance();
