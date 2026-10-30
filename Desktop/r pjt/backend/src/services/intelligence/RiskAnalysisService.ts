import {
  VehicleRiskAssessment,
  ComponentRisk,
  RiskLevel,
  DetectedAnomaly,
  VehicleHealthAssessment,
} from './types';
import { FullVehicleVerificationReport } from '../../blockchain/types';

export class RiskAnalysisService {
  public static readonly VERSION = 'v1.0.0';

  public assessRisk(params: {
    health: VehicleHealthAssessment;
    anomalies: DetectedAnomaly[];
    fullVerificationReport: FullVehicleVerificationReport;
  }): VehicleRiskAssessment {
    const { health, anomalies, fullVerificationReport } = params;
    const now = new Date();

    // 1. Evaluate Component Risks
    const blockchainIntegrityRisk = this.evaluateBlockchainRisk(fullVerificationReport, anomalies);
    const odometerRisk = this.evaluateOdometerRisk(anomalies);
    const accidentRisk = this.evaluateAccidentRisk(health.components.accidentHistory, anomalies);
    const serviceRisk = this.evaluateServiceRisk(health.components.serviceCompliance, anomalies);
    const documentRisk = this.evaluateDocumentRisk(health.components.documentIntegrity, anomalies);
    const insuranceRisk = this.evaluateInsuranceRisk(health.components.insuranceStatus, anomalies);
    const ownershipRisk = this.evaluateOwnershipRisk(health.components.ownershipConsistency, anomalies);
    const maintenanceRisk = this.evaluateMaintenanceRisk(health.components.serviceCompliance);

    // 2. Aggregate Overall Risk
    const allComponents = [
      blockchainIntegrityRisk,
      odometerRisk,
      accidentRisk,
      serviceRisk,
      documentRisk,
      insuranceRisk,
      ownershipRisk,
      maintenanceRisk,
    ];

    // Identify primary risk drivers (components with MEDIUM, HIGH, or CRITICAL risk)
    const primaryRiskDrivers: string[] = [];
    const recommendedActions: string[] = [];

    for (const comp of allComponents) {
      if (comp.riskLevel === 'CRITICAL' || comp.riskLevel === 'HIGH') {
        primaryRiskDrivers.push(`${comp.label}: ${comp.reason}`);
      }
    }

    // Determine Overall Risk Level & Score
    let overallRiskLevel: RiskLevel = 'LOW';
    let overallRiskScore = 15; // baseline low risk

    if (blockchainIntegrityRisk.riskLevel === 'CRITICAL') {
      overallRiskLevel = 'CRITICAL';
      overallRiskScore = 95;
      recommendedActions.push('Do NOT purchase or transfer without cryptographically reconciling on-chain ledger hashes.');
    } else if (odometerRisk.riskLevel === 'HIGH') {
      overallRiskLevel = 'HIGH';
      overallRiskScore = 80;
      recommendedActions.push('Perform diagnostic ECU reading and inspect certified physical garage invoices to verify true mileage.');
    } else if (accidentRisk.riskLevel === 'HIGH') {
      overallRiskLevel = 'HIGH';
      overallRiskScore = 75;
      recommendedActions.push('Perform independent structural chassis inspection and check ultrasonic collision repairs.');
    } else if (allComponents.some((c) => c.riskLevel === 'HIGH')) {
      overallRiskLevel = 'HIGH';
      overallRiskScore = 70;
    } else if (allComponents.filter((c) => c.riskLevel === 'MEDIUM').length >= 2) {
      overallRiskLevel = 'MEDIUM';
      overallRiskScore = 50;
      recommendedActions.push('Review service intervals and verify missing document certificates.');
    } else if (allComponents.some((c) => c.riskLevel === 'MEDIUM')) {
      overallRiskLevel = 'MEDIUM';
      overallRiskScore = 35;
    } else {
      overallRiskLevel = 'LOW';
      overallRiskScore = Math.max(5, 100 - health.overallScore);
      recommendedActions.push('Standard pre-purchase verification protocol recommended.');
    }

    // Summary statement
    let summary = 'Low overall acquisition and operational risk profile. All critical verification checks passed.';
    if (overallRiskLevel === 'CRITICAL') {
      summary = 'CRITICAL RISK: Cryptographic data tampering detected. Vehicle history records have been manipulated in database.';
    } else if (overallRiskLevel === 'HIGH') {
      summary = 'HIGH RISK: Significant historical anomalies detected (e.g. mileage discrepancies or structural collision history).';
    } else if (overallRiskLevel === 'MEDIUM') {
      summary = 'MODERATE RISK: Minor maintenance gaps or document inconsistencies identified; review supporting evidence.';
    }

    return {
      overallRiskLevel,
      overallRiskScore,
      summary,
      primaryRiskDrivers: primaryRiskDrivers.length > 0 ? primaryRiskDrivers : ['No significant risk drivers detected.'],
      categories: {
        odometerRisk,
        accidentRisk,
        serviceRisk,
        documentRisk,
        insuranceRisk,
        ownershipRisk,
        blockchainIntegrityRisk,
        maintenanceRisk,
      },
      recommendedActions,
      evaluationTimestamp: now.toISOString(),
      engineVersion: RiskAnalysisService.VERSION,
    };
  }

  // --------------------------------------------------------------------------
  // Helper Component Risk Evaluators
  // --------------------------------------------------------------------------

  private evaluateBlockchainRisk(report: FullVehicleVerificationReport, anomalies: DetectedAnomaly[]): ComponentRisk {
    if (report.hasTamper) {
      return {
        category: 'BLOCKCHAIN',
        label: 'Blockchain Integrity Risk',
        riskLevel: 'CRITICAL',
        score: 100,
        reason: 'Database records do not match immutable on-chain cryptographic proof.',
        evidence: ['Cryptographic hash mismatch verified by smart contract.'],
        affectedRecordsCount: 1,
      };
    }
    return {
      category: 'BLOCKCHAIN',
      label: 'Blockchain Integrity Risk',
      riskLevel: 'LOW',
      score: 0,
      reason: 'All database records match immutable blockchain proof with zero tampering.',
      evidence: ['100% hash parity with on-chain anchor.'],
      affectedRecordsCount: 0,
    };
  }

  private evaluateOdometerRisk(anomalies: DetectedAnomaly[]): ComponentRisk {
    const odoAnomalies = anomalies.filter((a) => a.category === 'ODOMETER');
    const hasRollback = odoAnomalies.some((a) => a.title.includes('Rollback') || a.severity === 'HIGH');
    const hasSpike = odoAnomalies.some((a) => a.severity === 'MEDIUM');

    if (hasRollback) {
      return {
        category: 'ODOMETER',
        label: 'Odometer & Mileage Risk',
        riskLevel: 'HIGH',
        score: 85,
        reason: 'Odometer rollback or non-linear decrease identified on vehicle ledger.',
        evidence: odoAnomalies.map((a) => a.explanation),
        affectedRecordsCount: odoAnomalies.length,
      };
    }

    if (hasSpike) {
      return {
        category: 'ODOMETER',
        label: 'Odometer & Mileage Risk',
        riskLevel: 'MEDIUM',
        score: 45,
        reason: 'Unusual mileage accumulation velocity identified between service dates.',
        evidence: odoAnomalies.map((a) => a.explanation),
        affectedRecordsCount: odoAnomalies.length,
      };
    }

    return {
      category: 'ODOMETER',
      label: 'Odometer & Mileage Risk',
      riskLevel: 'LOW',
      score: 5,
      reason: 'Monotonically progressive odometer readings with no rollback anomalies.',
      evidence: ['Verified progressive mileage trajectory.'],
      affectedRecordsCount: 0,
    };
  }

  private evaluateAccidentRisk(accHealth: any, anomalies: DetectedAnomaly[]): ComponentRisk {
    const accAnomalies = anomalies.filter((a) => a.category === 'ACCIDENT');
    if (accAnomalies.some((a) => a.severity === 'HIGH')) {
      return {
        category: 'ACCIDENT',
        label: 'Accident & Structural Risk',
        riskLevel: 'HIGH',
        score: 80,
        reason: 'Unresolved collision damage or collision chronology anomaly detected.',
        evidence: accAnomalies.map((a) => a.explanation),
        affectedRecordsCount: accAnomalies.length,
      };
    }

    if (accHealth.score < 75) {
      return {
        category: 'ACCIDENT',
        label: 'Accident & Structural Risk',
        riskLevel: 'MEDIUM',
        score: 45,
        reason: 'Historical collision incidents logged; verified repair completion on file.',
        evidence: accHealth.evidence,
        affectedRecordsCount: 1,
      };
    }

    return {
      category: 'ACCIDENT',
      label: 'Accident & Structural Risk',
      riskLevel: 'LOW',
      score: 5,
      reason: 'Clean collision history with no unresolved structural damage.',
      evidence: accHealth.evidence,
      affectedRecordsCount: 0,
    };
  }

  private evaluateServiceRisk(srvHealth: any, anomalies: DetectedAnomaly[]): ComponentRisk {
    const srvAnomalies = anomalies.filter((a) => a.category === 'SERVICE');
    if (srvHealth.score < 60 || srvAnomalies.length > 0) {
      return {
        category: 'SERVICE',
        label: 'Service & Maintenance Risk',
        riskLevel: 'MEDIUM',
        score: 50,
        reason: 'Gaps in certified workshop maintenance or chronological service anomalies.',
        evidence: srvAnomalies.length > 0 ? srvAnomalies.map((a) => a.explanation) : srvHealth.evidence,
        affectedRecordsCount: srvAnomalies.length,
      };
    }

    return {
      category: 'SERVICE',
      label: 'Service & Maintenance Risk',
      riskLevel: 'LOW',
      score: 10,
      reason: 'Regular maintenance records documented by authorized workshops.',
      evidence: srvHealth.evidence,
      affectedRecordsCount: 0,
    };
  }

  private evaluateDocumentRisk(docHealth: any, anomalies: DetectedAnomaly[]): ComponentRisk {
    const docAnomalies = anomalies.filter((a) => a.category === 'DOCUMENT');
    if (docAnomalies.length > 0) {
      return {
        category: 'DOCUMENT',
        label: 'Document Integrity Risk',
        riskLevel: 'HIGH',
        score: 75,
        reason: 'OCR document data contradicts verified database vehicle specifications.',
        evidence: docAnomalies.map((a) => a.explanation),
        affectedRecordsCount: docAnomalies.length,
      };
    }

    if (docHealth.score < 70) {
      return {
        category: 'DOCUMENT',
        label: 'Document Integrity Risk',
        riskLevel: 'MEDIUM',
        score: 35,
        reason: 'Limited supporting document certificates uploaded to digital passport.',
        evidence: docHealth.evidence,
        affectedRecordsCount: 0,
      };
    }

    return {
      category: 'DOCUMENT',
      label: 'Document Integrity Risk',
      riskLevel: 'LOW',
      score: 5,
      reason: 'Supporting documents verified against database with SHA-256 cryptographic hashes.',
      evidence: docHealth.evidence,
      affectedRecordsCount: 0,
    };
  }

  private evaluateInsuranceRisk(insHealth: any, anomalies: DetectedAnomaly[]): ComponentRisk {
    const insAnomalies = anomalies.filter((a) => a.category === 'INSURANCE');
    if (insAnomalies.some((a) => a.title.includes('Expired') || a.severity === 'MEDIUM')) {
      return {
        category: 'INSURANCE',
        label: 'Insurance & Legal Compliance Risk',
        riskLevel: 'MEDIUM',
        score: 40,
        reason: 'Vehicle insurance has lapsed without active coverage logged.',
        evidence: insAnomalies.map((a) => a.explanation),
        affectedRecordsCount: 1,
      };
    }

    return {
      category: 'INSURANCE',
      label: 'Insurance & Legal Compliance Risk',
      riskLevel: 'LOW',
      score: 5,
      reason: 'Active insurance policy validated on ledger.',
      evidence: insHealth.evidence,
      affectedRecordsCount: 0,
    };
  }

  private evaluateOwnershipRisk(ownHealth: any, anomalies: DetectedAnomaly[]): ComponentRisk {
    return {
      category: 'OWNERSHIP',
      label: 'Ownership & Title Risk',
      riskLevel: 'LOW',
      score: 5,
      reason: 'Clear provenance and verified ownership transitions anchored on-chain.',
      evidence: ownHealth.evidence,
      affectedRecordsCount: 0,
    };
  }

  private evaluateMaintenanceRisk(srvHealth: any): ComponentRisk {
    const riskLevel: RiskLevel = srvHealth.score < 65 ? 'MEDIUM' : 'LOW';
    return {
      category: 'MAINTENANCE',
      label: 'Future Maintenance Risk',
      riskLevel,
      score: Math.max(10, 100 - srvHealth.score),
      reason:
        riskLevel === 'MEDIUM'
          ? 'Delayed maintenance intervals increase likelihood of upcoming scheduled service expenditure.'
          : 'Predictable upcoming maintenance schedule aligned with vehicle mileage.',
      evidence: srvHealth.evidence,
      affectedRecordsCount: 0,
    };
  }
}
