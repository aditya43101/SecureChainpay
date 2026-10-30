import {
  InvestigationReport,
  InvestigationRunDTO,
  InvestigationEvidenceDTO,
  StructuredFinding,
  FindingSeverity,
} from './types';
import { evidenceEngine } from './evidenceEngine';

export class ReportGenerator {
  private static instance: ReportGenerator;

  public static getInstance(): ReportGenerator {
    if (!ReportGenerator.instance) {
      ReportGenerator.instance = new ReportGenerator();
    }
    return ReportGenerator.instance;
  }

  /**
   * Generates a fully validated, evidence-grounded InvestigationReport
   */
  public async generateReport(params: {
    run: InvestigationRunDTO;
    evidenceList: InvestigationEvidenceDTO[];
  }): Promise<InvestigationReport> {
    const { run, evidenceList } = params;

    // 1. Synthesize baseline structured claims from persisted evidence
    const { verifiedFacts, observations, contradictions, unknowns } = evidenceEngine.synthesizeClaims(evidenceList);

    // 2. Synthesize structured findings
    const findings = this.synthesizeFindings(evidenceList, contradictions);

    // 3. Compute verification results matrix
    const verificationResults = this.computeVerificationMatrix(evidenceList);

    // 4. Evidence reference validation: Ensure all cited evidence numbers exist in collected evidence
    const validEvidenceNumbers = new Set(evidenceList.map((e) => e.evidenceNumber));
    for (const f of findings) {
      f.supportingEvidenceRefs = f.supportingEvidenceRefs.filter((ref) => validEvidenceNumbers.has(ref));
      f.contradictingEvidenceRefs = f.contradictingEvidenceRefs.filter((ref) => validEvidenceNumbers.has(ref));
    }

    // 5. Build executive summary
    const executiveSummary = this.buildExecutiveSummary(run, evidenceList, findings, contradictions);

    // 6. Recommended next steps
    const recommendedNextSteps = this.buildRecommendedNextSteps(findings, contradictions, unknowns);

    // 7. Evidentiary limitations
    const limitations = [
      'Findings indicate empirical record contradictions or anomalies; they do not establish legal culpability or intentional fraud.',
      'A lower odometer reading may indicate instrument cluster replacement, data-entry error, or imported history rather than mechanical tampering.',
      'Cryptographic verification confirms data integrity against on-chain commitments; it does not independently verify the physical truth of historical claims.',
      'External dependency unavailability (e.g. RPC node timeout) is categorized as technical unavailability, not data tampering.',
    ];

    const report: InvestigationReport = {
      investigationId: run.id,
      runNumber: run.runNumber,
      vehicleId: run.vehicleId || undefined,
      targetType: run.targetType as any,
      targetId: run.targetId,
      investigationType: run.investigationType,
      status: contradictions.length > 0 ? 'REVIEW_REQUIRED' : 'COMPLETED',
      generatedAt: new Date().toISOString(),
      reportVersion: '1.0',
      executiveSummary,
      verifiedFacts,
      observations,
      findings,
      contradictions,
      unknowns,
      verificationResults,
      recommendedNextSteps,
      limitations,
      evidenceSummary: {
        totalItems: evidenceList.length,
        verifiedCount: evidenceList.filter((e) => e.verificationStatus === 'VERIFIED').length,
        unverifiedCount: evidenceList.filter((e) => e.verificationStatus === 'UNVERIFIED').length,
        mismatchCount: evidenceList.filter((e) => e.verificationStatus === 'MISMATCH').length,
      },
    };

    return report;
  }

  /**
   * Synthesizes findings grounded strictly in collected evidence
   */
  private synthesizeFindings(
    evidenceList: InvestigationEvidenceDTO[],
    contradictions: string[]
  ): StructuredFinding[] {
    const findings: StructuredFinding[] = [];

    // Check Odometer evidence
    const odoDrops = evidenceList.filter(
      (e) => e.evidenceType === 'ODOMETER_RECORD' && e.verificationStatus === 'MISMATCH'
    );
    if (odoDrops.length > 0) {
      findings.push({
        findingId: `FINDING-ODO-${findings.length + 1}`,
        category: 'ODOMETER_INTEGRITY',
        severity: 'HIGH',
        assessmentStatus: 'CONFIRMED_ANOMALY',
        title: 'Non-Monotonic Odometer Telemetry Sequence Detected',
        explanation: `Historical odometer telemetry contains ${odoDrops.length} reading(s) that are lower than previously recorded timestamps without verified cluster replacement certification.`,
        supportingEvidenceRefs: [],
        contradictingEvidenceRefs: odoDrops.map((e) => e.evidenceNumber),
        verificationResults: ['Odometer telemetry sequence failed monotonic ordering constraint.'],
        limitations: 'May be explained by instrument cluster replacement or technician typo if supporting documentation is furnished.',
        recommendedNextSteps: [
          'Request physical inspection report or certified garage service invoice from the date of the decrease.',
          'Verify if an instrument cluster replacement or odometer calibration was performed.',
        ],
      });
    }

    // Check Document discrepancies
    const docMismatches = evidenceList.filter(
      (e) => (e.evidenceType === 'DOCUMENT' || e.evidenceType === 'DOCUMENT_VERIFICATION') && e.verificationStatus === 'MISMATCH'
    );
    if (docMismatches.length > 0) {
      findings.push({
        findingId: `FINDING-DOC-${findings.length + 1}`,
        category: 'DOCUMENT_INTEGRITY',
        severity: 'MEDIUM',
        assessmentStatus: 'REQUIRES_HUMAN_REVIEW',
        title: 'Document OCR and Database Field Discrepancy',
        explanation: 'One or more vehicle documents have OCR-extracted VIN or registration values that conflict with database records.',
        supportingEvidenceRefs: [],
        contradictingEvidenceRefs: docMismatches.map((e) => e.evidenceNumber),
        verificationResults: ['Document consistency audit status: INCONSISTENT.'],
        limitations: 'Optical character recognition noise or scanning artifacts can cause false-positive character mismatches.',
        recommendedNextSteps: [
          'Perform manual visual comparison of the uploaded physical document scan against authoritative vehicle records.',
          'Re-scan or upload higher resolution copy if optical degradation is observed.',
        ],
      });
    }

    // Check Blockchain / Merkle verification failures
    const merkleFailures = evidenceList.filter(
      (e) => e.evidenceType === 'MERKLE_BATCH_INCLUSION' && e.verificationStatus === 'MISMATCH'
    );
    if (merkleFailures.length > 0) {
      findings.push({
        findingId: `FINDING-CRYPTO-${findings.length + 1}`,
        category: 'BLOCKCHAIN_VERIFICATION',
        severity: 'CRITICAL',
        assessmentStatus: 'CONFIRMED_ANOMALY',
        title: 'Post-Anchoring Database Record Modification Detected',
        explanation: 'Authoritative database record hash diverges from the cryptographic Merkle root commitment anchored on-chain.',
        supportingEvidenceRefs: [],
        contradictingEvidenceRefs: merkleFailures.map((e) => e.evidenceNumber),
        verificationResults: ['RECORD_HASH_MISMATCH against on-chain Merkle tree root.'],
        limitations: 'Indicates direct off-chain database modification after batch anchoring.',
        recommendedNextSteps: [
          'Audit database mutation logs for unauthorized field alterations.',
          'Execute Tamper Lab remediation or roll back record to snapshot committed in batch.',
        ],
      });
    }

    // Check Chronology anomalies
    const chronologyFailures = evidenceList.filter(
      (e) => e.evidenceType === 'CHRONOLOGY_AUDIT' && e.verificationStatus === 'MISMATCH'
    );
    if (chronologyFailures.length > 0) {
      findings.push({
        findingId: `FINDING-CHRONO-${findings.length + 1}`,
        category: 'CHRONOLOGY_VIOLATION',
        severity: 'MEDIUM',
        assessmentStatus: 'REQUIRES_HUMAN_REVIEW',
        title: 'Timeline Chronology Inversion Identified',
        explanation: 'Event timestamps exhibit impossible sequencing, such as service events predating vehicle manufacturing or repairs preceding collisions.',
        supportingEvidenceRefs: [],
        contradictingEvidenceRefs: chronologyFailures.map((e) => e.evidenceNumber),
        limitations: 'Data entry dates may have entered invoice processing date rather than physical incident date.',
        recommendedNextSteps: [
          'Cross-examine servicing garage work orders and accident first-responder logs.',
        ],
      });
    }

    // Check existing Phase 7 findings
    const graphFindings = evidenceList.filter((e) => e.evidenceType === 'FRAUD_FINDING');
    for (const gf of graphFindings) {
      const prov = gf.provenance || {};
      findings.push({
        findingId: `FINDING-GRAPH-${findings.length + 1}`,
        category: prov.category || 'CROSS_ENTITY_ANOMALY',
        severity: (prov.severity as FindingSeverity) || 'MEDIUM',
        assessmentStatus: 'REQUIRES_HUMAN_REVIEW',
        title: `Fraud Graph Finding: ${prov.ruleId || 'ANOMALY'}`,
        explanation: prov.explanation || gf.description,
        supportingEvidenceRefs: [],
        contradictingEvidenceRefs: [gf.evidenceNumber],
        limitations: prov.unknowns || undefined,
        recommendedNextSteps: prov.recommendedAction ? [prov.recommendedAction] : ['Investigate connected entities in the Fraud Intelligence Graph.'],
      });
    }

    return findings;
  }

  private computeVerificationMatrix(evidenceList: InvestigationEvidenceDTO[]) {
    const hasHashVerified = evidenceList.some((e) => e.evidenceType === 'RECORD_CRYPTOGRAPHIC_PROOF' && e.verificationStatus === 'VERIFIED');
    const hasHashMismatch = evidenceList.some((e) => e.evidenceType === 'RECORD_CRYPTOGRAPHIC_PROOF' && e.verificationStatus === 'MISMATCH');

    const hasAnchorVerified = evidenceList.some((e) => e.evidenceType === 'BLOCKCHAIN_ANCHOR_STATE' && e.verificationStatus === 'VERIFIED');
    const hasAnchorMismatch = evidenceList.some((e) => e.evidenceType === 'BLOCKCHAIN_ANCHOR_STATE' && e.verificationStatus === 'MISMATCH');
    const hasAnchorUnavailable = evidenceList.some((e) => e.evidenceType === 'BLOCKCHAIN_ANCHOR_STATE' && e.verificationStatus === 'UNAVAILABLE');

    const hasMerkleVerified = evidenceList.some((e) => e.evidenceType === 'MERKLE_BATCH_INCLUSION' && e.verificationStatus === 'VERIFIED');
    const hasMerkleMismatch = evidenceList.some((e) => e.evidenceType === 'MERKLE_BATCH_INCLUSION' && e.verificationStatus === 'MISMATCH');
    const hasMerkleUnavailable = evidenceList.some((e) => e.evidenceType === 'MERKLE_BATCH_INCLUSION' && e.verificationStatus === 'UNAVAILABLE');

    const hasDocVerified = evidenceList.some((e) => e.evidenceType === 'DOCUMENT_VERIFICATION' && e.verificationStatus === 'VERIFIED');
    const hasDocMismatch = evidenceList.some((e) => e.evidenceType === 'DOCUMENT_VERIFICATION' && e.verificationStatus === 'MISMATCH');

    return {
      canonicalHashing: hasHashMismatch ? ('MISMATCH' as const) : hasHashVerified ? ('VERIFIED' as const) : ('NOT_EVALUATED' as const),
      blockchainAnchoring: hasAnchorMismatch ? ('UNANCHORED' as const) : hasAnchorVerified ? ('CONFIRMED' as const) : hasAnchorUnavailable ? ('UNAVAILABLE' as const) : ('NOT_EVALUATED' as const),
      merkleInclusion: hasMerkleMismatch ? ('MISMATCH' as const) : hasMerkleVerified ? ('VERIFIED' as const) : hasMerkleUnavailable ? ('UNAVAILABLE' as const) : ('NOT_EVALUATED' as const),
      documentConsistency: hasDocMismatch ? ('INCONSISTENT' as const) : hasDocVerified ? ('CONSISTENT' as const) : ('NOT_EVALUATED' as const),
    };
  }

  private buildExecutiveSummary(
    run: InvestigationRunDTO,
    evidenceList: InvestigationEvidenceDTO[],
    findings: StructuredFinding[],
    contradictions: string[]
  ): string {
    const total = evidenceList.length;
    const verified = evidenceList.filter((e) => e.verificationStatus === 'VERIFIED').length;
    const mismatches = evidenceList.filter((e) => e.verificationStatus === 'MISMATCH').length;

    let summary = `Autonomous Investigation ${run.runNumber} was conducted for target ${run.targetType} "${run.targetId}" under investigation protocol ${run.investigationType}. `;
    summary += `A total of ${total} evidence items were collected and evaluated (${verified} cryptographically verified, ${mismatches} contradictions identified).\n\n`;

    if (findings.length === 0 && contradictions.length === 0) {
      summary += `RESULT: Ground-truth consistency confirmed. All verified telemetry, service logs, and blockchain anchors demonstrate uninterrupted integrity. No discrepancies or chronological anomalies were detected.`;
    } else {
      const highSeverityCount = findings.filter((f) => f.severity === 'HIGH' || f.severity === 'CRITICAL').length;
      summary += `STATUS: ${findings.length} substantive finding(s) identified (${highSeverityCount} high/critical priority). `;
      summary += `Primary concerns involve: ${findings.map((f) => f.title).join('; ')}. `;
      summary += `Immediate human reviewer triage is recommended.`;
    }

    return summary;
  }

  private buildRecommendedNextSteps(
    findings: StructuredFinding[],
    contradictions: string[],
    unknowns: string[]
  ): string[] {
    const steps: string[] = [];

    for (const f of findings) {
      for (const step of f.recommendedNextSteps) {
        if (!steps.includes(step)) {
          steps.push(step);
        }
      }
    }

    if (contradictions.length > 0 && !steps.some((s) => s.includes('Investigation Case'))) {
      steps.push('Open a formal Investigation Case to coordinate forensic follow-up with certified garage or insurer.');
    }

    if (unknowns.length > 0) {
      steps.push('Request missing historical documentation from current owner or servicing entities to resolve open uncertainties.');
    }

    if (steps.length === 0) {
      steps.push('No immediate remediation required. Vehicle passport maintains active verified status.');
    }

    return steps;
  }
}

export const reportGenerator = ReportGenerator.getInstance();
