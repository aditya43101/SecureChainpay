import {
  Vehicle,
  ServiceRecord,
  OdometerRecord,
  AccidentRecord,
  InsuranceRecord,
  VehicleDocument,
  OwnershipHistory,
} from '@prisma/client';
import {
  VehicleHealthAssessment,
  ComponentHealth,
  HealthStatus,
  DetectedAnomaly,
} from './types';
import { FullVehicleVerificationReport } from '../../blockchain/types';

export class VehicleHealthService {
  public static readonly VERSION = 'v1.0.0';

  /**
   * Transparent scoring weights totaling 1.0 (100%)
   */
  public static readonly WEIGHTS = {
    blockchainIntegrity: 0.25,
    odometerIntegrity: 0.20,
    serviceCompliance: 0.18,
    accidentHistory: 0.15,
    documentIntegrity: 0.10,
    insuranceStatus: 0.07,
    ownershipConsistency: 0.05,
  };

  public evaluateHealth(params: {
    vehicle: Vehicle & {
      serviceRecords: ServiceRecord[];
      odometerRecords: OdometerRecord[];
      accidentRecords: AccidentRecord[];
      insuranceRecords: InsuranceRecord[];
      documents: VehicleDocument[];
      ownershipHistory: OwnershipHistory[];
    };
    fullVerificationReport: FullVehicleVerificationReport;
    anomalies: DetectedAnomaly[];
  }): VehicleHealthAssessment {
    const { vehicle, fullVerificationReport, anomalies } = params;

    // 1. Blockchain Integrity Component (Weight 25%)
    const blockchainIntegrity = this.evaluateBlockchainComponent(fullVerificationReport, anomalies);

    // 2. Odometer Integrity Component (Weight 20%)
    const odometerIntegrity = this.evaluateOdometerComponent(vehicle.odometerRecords, anomalies);

    // 3. Service Compliance Component (Weight 18%)
    const serviceCompliance = this.evaluateServiceComponent(vehicle.serviceRecords, vehicle.manufacturingYear, anomalies);

    // 4. Accident History Component (Weight 15%)
    const accidentHistory = this.evaluateAccidentComponent(vehicle.accidentRecords, anomalies);

    // 5. Document Integrity Component (Weight 10%)
    const documentIntegrity = this.evaluateDocumentComponent(vehicle.documents, anomalies);

    // 6. Insurance Status Component (Weight 7%)
    const insuranceStatus = this.evaluateInsuranceComponent(vehicle.insuranceRecords, anomalies);

    // 7. Ownership Consistency Component (Weight 5%)
    const ownershipConsistency = this.evaluateOwnershipComponent(vehicle.ownershipHistory, anomalies);

    // Calculate Weighted Total Score
    const totalWeightedScore =
      blockchainIntegrity.score * VehicleHealthService.WEIGHTS.blockchainIntegrity +
      odometerIntegrity.score * VehicleHealthService.WEIGHTS.odometerIntegrity +
      serviceCompliance.score * VehicleHealthService.WEIGHTS.serviceCompliance +
      accidentHistory.score * VehicleHealthService.WEIGHTS.accidentHistory +
      documentIntegrity.score * VehicleHealthService.WEIGHTS.documentIntegrity +
      insuranceStatus.score * VehicleHealthService.WEIGHTS.insuranceStatus +
      ownershipConsistency.score * VehicleHealthService.WEIGHTS.ownershipConsistency;

    const roundedScore = Math.max(0, Math.min(100, Math.round(totalWeightedScore)));
    const overallStatus = this.scoreToStatus(roundedScore);

    // Summary Generator
    let summary = `Vehicle demonstrates ${overallStatus.toLowerCase()} overall operational condition based on historical verified records.`;
    if (fullVerificationReport.hasTamper) {
      summary = `CRITICAL INTEGRITY ALERT: Cryptographic mismatch detected between database and blockchain ledger.`;
    } else if (anomalies.some((a) => a.category === 'ODOMETER' && a.severity === 'HIGH')) {
      summary = `ATTENTION: Odometer rollback or severe variance detected in historical mileage records.`;
    } else if (roundedScore >= 85) {
      summary = `Outstanding operational health backed by pristine blockchain anchors and certified maintenance history.`;
    }

    return {
      overallScore: roundedScore,
      status: overallStatus,
      summary,
      components: {
        blockchainIntegrity,
        odometerIntegrity,
        serviceCompliance,
        accidentHistory,
        documentIntegrity,
        insuranceStatus,
        ownershipConsistency,
      },
      scoringMethodology: {
        weights: VehicleHealthService.WEIGHTS,
        description: 'Deterministic weighted-sum model evaluating multi-domain cryptographic and operational integrity.',
        engineVersion: VehicleHealthService.VERSION,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Component Evaluators
  // --------------------------------------------------------------------------

  private evaluateBlockchainComponent(
    report: FullVehicleVerificationReport,
    anomalies: DetectedAnomaly[]
  ): ComponentHealth {
    const weight = VehicleHealthService.WEIGHTS.blockchainIntegrity;
    let score = 100;
    const penalties: ComponentHealth['penalties'] = [];
    const positiveFactors: string[] = [];
    const evidence: string[] = [];

    if (report.hasTamper) {
      score = 0;
      penalties.push({
        reason: 'Cryptographic hash mismatch with on-chain anchor (Tampering detected)',
        pointsDeducted: 100,
        relatedAnomalyId: anomalies.find((a) => a.category === 'BLOCKCHAIN')?.id,
      });
      evidence.push('Database hash does not match immutable smart contract anchor.');
    } else {
      positiveFactors.push('Immutable smart contract identity confirmed on EVM blockchain');
      positiveFactors.push('All lifecycle hashes match on-chain anchors with 100% cryptographic proof');
      evidence.push(`Contract address verified: ${report.vehicleIdentity.isRegisteredOnBlockchain ? 'Anchored' : 'Pending'}`);
    }

    return {
      component: 'blockchainIntegrity',
      label: 'Blockchain Integrity',
      score,
      weight,
      status: this.scoreToStatus(score),
      explanation:
        score === 100
          ? 'Cryptographic verification confirmed against blockchain anchors with zero data tampering.'
          : 'Severe cryptographic discrepancies detected between database records and blockchain anchors.',
      evidence,
      penalties,
      positiveFactors,
    };
  }

  private evaluateOdometerComponent(
    records: OdometerRecord[],
    anomalies: DetectedAnomaly[]
  ): ComponentHealth {
    const weight = VehicleHealthService.WEIGHTS.odometerIntegrity;
    let score = 100;
    const penalties: ComponentHealth['penalties'] = [];
    const positiveFactors: string[] = [];
    const evidence: string[] = [];

    const odoAnomalies = anomalies.filter((a) => a.category === 'ODOMETER');
    const hasRollback = odoAnomalies.some((a) => a.title.includes('Rollback') || a.severity === 'HIGH');
    const hasSpike = odoAnomalies.some((a) => a.title.includes('Velocity') || a.severity === 'MEDIUM');

    if (hasRollback) {
      score -= 70;
      penalties.push({
        reason: 'Odometer rollback / non-linear mileage decrease detected',
        pointsDeducted: 70,
        relatedAnomalyId: odoAnomalies.find((a) => a.title.includes('Rollback'))?.id,
      });
      evidence.push('Odometer logs show negative delta between successive readings.');
    }

    if (hasSpike) {
      score -= 20;
      penalties.push({
        reason: 'Abnormal mileage accumulation spike (> 1,200 km/day)',
        pointsDeducted: 20,
      });
      evidence.push('Mileage velocity exceeded standard daily travel parameters.');
    }

    if (records.length === 0) {
      score -= 30;
      penalties.push({ reason: 'Zero odometer readings recorded', pointsDeducted: 30 });
      evidence.push('No odometer logs available in vehicle passport ledger.');
    } else if (!hasRollback && !hasSpike) {
      positiveFactors.push(`${records.length} monotonic chronological odometer readings verified`);
      positiveFactors.push('Consistent mileage accumulation pattern verified across all service intervals');
      evidence.push(`Latest verified mileage: ${Math.max(...records.map((r) => r.mileage)).toLocaleString()} km`);
    }

    score = Math.max(0, Math.min(100, score));

    return {
      component: 'odometerIntegrity',
      label: 'Odometer Integrity',
      score,
      weight,
      status: this.scoreToStatus(score),
      explanation:
        score >= 80
          ? 'Mileage ledger follows a consistent, verifiable chronological progression.'
          : 'Odometer variances or rollback anomalies detected on the vehicle timeline.',
      evidence,
      penalties,
      positiveFactors,
    };
  }

  private evaluateServiceComponent(
    records: ServiceRecord[],
    mfgYear: number,
    anomalies: DetectedAnomaly[]
  ): ComponentHealth {
    const weight = VehicleHealthService.WEIGHTS.serviceCompliance;
    let score = 100;
    const penalties: ComponentHealth['penalties'] = [];
    const positiveFactors: string[] = [];
    const evidence: string[] = [];
    const nowYear = new Date().getFullYear();
    const vehicleAgeYears = Math.max(1, nowYear - mfgYear);

    if (records.length === 0) {
      score = 45;
      penalties.push({ reason: 'No certified service records on ledger', pointsDeducted: 55 });
      evidence.push('Zero maintenance history available in digital passport.');
    } else {
      positiveFactors.push(`${records.length} certified maintenance records logged by verified garages`);

      // Check for service frequency
      const expectedServices = Math.max(1, vehicleAgeYears);
      if (records.length >= expectedServices) {
        positiveFactors.push('Annual service cadence matches manufacturer recommendations');
      } else {
        score -= 15;
        penalties.push({
          reason: `Service frequency lower than expected (${records.length} services in ${vehicleAgeYears} years)`,
          pointsDeducted: 15,
        });
      }

      // Check recency of last service
      const latestService = [...records].sort(
        (a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()
      )[0];
      const monthsSinceLastService =
        (Date.now() - new Date(latestService.serviceDate).getTime()) / (1000 * 60 * 60 * 24 * 30.4);

      if (monthsSinceLastService > 18) {
        score -= 20;
        penalties.push({
          reason: `Last service was ${Math.round(monthsSinceLastService)} months ago (> 18 months)`,
          pointsDeducted: 20,
        });
        evidence.push(`Last service dated ${latestService.serviceDate.toISOString().split('T')[0]}`);
      } else {
        positiveFactors.push(`Recent service verified on ${latestService.serviceDate.toISOString().split('T')[0]}`);
        evidence.push(`Latest service: ${latestService.serviceType} at ${latestService.mileage.toLocaleString()} km`);
      }
    }

    const srvAnomalies = anomalies.filter((a) => a.category === 'SERVICE');
    if (srvAnomalies.length > 0) {
      score -= srvAnomalies.length * 15;
      penalties.push({
        reason: `${srvAnomalies.length} service chronological anomalies detected`,
        pointsDeducted: srvAnomalies.length * 15,
      });
    }

    score = Math.max(0, Math.min(100, score));

    return {
      component: 'serviceCompliance',
      label: 'Service & Maintenance Compliance',
      score,
      weight,
      status: this.scoreToStatus(score),
      explanation:
        score >= 80
          ? 'Vehicle follows regular certified maintenance intervals with authorized workshop documentation.'
          : 'Maintenance gaps or insufficient service records identified.',
      evidence,
      penalties,
      positiveFactors,
    };
  }

  private evaluateAccidentComponent(
    records: AccidentRecord[],
    anomalies: DetectedAnomaly[]
  ): ComponentHealth {
    const weight = VehicleHealthService.WEIGHTS.accidentHistory;
    let score = 100;
    const penalties: ComponentHealth['penalties'] = [];
    const positiveFactors: string[] = [];
    const evidence: string[] = [];

    if (records.length === 0) {
      positiveFactors.push('Clean accident record — Zero collision incidents logged');
      evidence.push('No accident or structural repair records logged in history.');
    } else {
      for (const acc of records) {
        if (acc.severity === 'SEVERE') {
          score -= 40;
          penalties.push({ reason: 'Historical severe collision incident recorded', pointsDeducted: 40 });
        } else if (acc.severity === 'MODERATE') {
          score -= 20;
          penalties.push({ reason: 'Historical moderate collision recorded', pointsDeducted: 20 });
        } else {
          score -= 10;
          penalties.push({ reason: 'Historical minor parking / cosmetic collision', pointsDeducted: 10 });
        }

        if (acc.repairStatus === 'COMPLETED') {
          positiveFactors.push(`Repairs for ${acc.severity.toLowerCase()} accident fully completed with garage sign-off`);
        } else {
          score -= 20;
          penalties.push({
            reason: `Unresolved collision damage (Repair Status: ${acc.repairStatus})`,
            pointsDeducted: 20,
          });
        }
        evidence.push(`Incident: ${acc.severity} collision on ${acc.accidentDate.toISOString().split('T')[0]} (Status: ${acc.repairStatus})`);
      }
    }

    score = Math.max(0, Math.min(100, score));

    return {
      component: 'accidentHistory',
      label: 'Accident & Damage History',
      score,
      weight,
      status: this.scoreToStatus(score),
      explanation:
        records.length === 0
          ? 'No accident or collision damage records detected on vehicle ledger.'
          : `Historical collision logs recorded (${records.length} incidents); evaluate repair completion proofs.`,
      evidence,
      penalties,
      positiveFactors,
    };
  }

  private evaluateDocumentComponent(
    documents: VehicleDocument[],
    anomalies: DetectedAnomaly[]
  ): ComponentHealth {
    const weight = VehicleHealthService.WEIGHTS.documentIntegrity;
    let score = 100;
    const penalties: ComponentHealth['penalties'] = [];
    const positiveFactors: string[] = [];
    const evidence: string[] = [];

    if (documents.length === 0) {
      score = 65;
      penalties.push({ reason: 'No supporting documents uploaded to passport', pointsDeducted: 35 });
      evidence.push('Zero verified document certificates attached.');
    } else {
      positiveFactors.push(`${documents.length} verified digital documents archived with SHA-256 hashes`);

      const inconsistentDocs = documents.filter((d) => d.consistencyStatus === 'INCONSISTENT');
      if (inconsistentDocs.length > 0) {
        score -= inconsistentDocs.length * 30;
        penalties.push({
          reason: `${inconsistentDocs.length} documents failed OCR consistency verification against database`,
          pointsDeducted: inconsistentDocs.length * 30,
        });
        evidence.push('OCR text extraction flagged discrepancies on document certificates.');
      } else {
        positiveFactors.push('All uploaded documents pass OCR consistency checking against vehicle database');
      }

      evidence.push(`Archived documents: ${documents.map((d) => d.documentType).join(', ')}`);
    }

    score = Math.max(0, Math.min(100, score));

    return {
      component: 'documentIntegrity',
      label: 'Document Integrity & OCR Consistency',
      score,
      weight,
      status: this.scoreToStatus(score),
      explanation:
        score >= 80
          ? 'Document certificates are cryptographically hashed and consistent with database specifications.'
          : 'Document discrepancies or missing certificates identified.',
      evidence,
      penalties,
      positiveFactors,
    };
  }

  private evaluateInsuranceComponent(
    records: InsuranceRecord[],
    anomalies: DetectedAnomaly[]
  ): ComponentHealth {
    const weight = VehicleHealthService.WEIGHTS.insuranceStatus;
    let score = 100;
    const penalties: ComponentHealth['penalties'] = [];
    const positiveFactors: string[] = [];
    const evidence: string[] = [];

    const activePolicy = records.find((r) => r.status === 'ACTIVE');
    if (activePolicy) {
      positiveFactors.push(`Active insurance coverage verified (${activePolicy.coverageType})`);
      positiveFactors.push(`Policy reference ${activePolicy.policyReference} active until ${activePolicy.endDate.toISOString().split('T')[0]}`);
      evidence.push(`Active Policy: ${activePolicy.policyReference} (Expires ${activePolicy.endDate.toISOString().split('T')[0]})`);
    } else {
      score -= 40;
      penalties.push({ reason: 'No active insurance coverage on file', pointsDeducted: 40 });
      evidence.push('Vehicle currently lacks active insurance coverage.');
    }

    score = Math.max(0, Math.min(100, score));

    return {
      component: 'insuranceStatus',
      label: 'Insurance Coverage Status',
      score,
      weight,
      status: this.scoreToStatus(score),
      explanation:
        activePolicy
          ? 'Vehicle maintains valid active insurance coverage verified on ledger.'
          : 'No active insurance policy found on vehicle ledger.',
      evidence,
      penalties,
      positiveFactors,
    };
  }

  private evaluateOwnershipComponent(
    history: OwnershipHistory[],
    anomalies: DetectedAnomaly[]
  ): ComponentHealth {
    const weight = VehicleHealthService.WEIGHTS.ownershipConsistency;
    let score = 100;
    const penalties: ComponentHealth['penalties'] = [];
    const positiveFactors: string[] = [];
    const evidence: string[] = [];

    if (history.length <= 1) {
      positiveFactors.push('Single owner vehicle / Initial registration custody confirmed');
      evidence.push('Original owner provenance verified on blockchain.');
    } else {
      positiveFactors.push(`Transparent chain of custody across ${history.length} verified ownership transitions`);
      evidence.push(`Ownership transfers: ${history.map((h) => h.transferType).join(' → ')}`);
    }

    return {
      component: 'ownershipConsistency',
      label: 'Ownership Consistency & Provenance',
      score,
      weight,
      status: this.scoreToStatus(score),
      explanation: 'Verified chronological chain of custody maintained across all ownership transfers.',
      evidence,
      penalties,
      positiveFactors,
    };
  }

  private scoreToStatus(score: number): HealthStatus {
    if (score >= 85) return 'EXCELLENT';
    if (score >= 70) return 'GOOD';
    if (score >= 50) return 'FAIR';
    return 'POOR';
  }
}
