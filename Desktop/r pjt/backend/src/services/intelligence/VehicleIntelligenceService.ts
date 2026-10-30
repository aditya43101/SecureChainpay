import { prisma } from '../../lib/prisma';
import { BlockchainService } from '../../blockchain/services/blockchainService';
import { AnomalyDetectionService } from './AnomalyDetectionService';
import { VehicleHealthService } from './VehicleHealthService';
import { RiskAnalysisService } from './RiskAnalysisService';
import { MaintenancePredictionService } from './MaintenancePredictionService';
import { IntelligenceAIService } from './IntelligenceAIService';
import { logAuditEvent } from '../auditService';
import { FullVehicleVerificationReport } from '../../blockchain/types';
import {
  VehicleIntelligenceReport,
  EvidenceGraph,
  EvidenceGraphNode,
  EvidenceGraphLink,
  DetectedAnomaly,
} from './types';

export class VehicleIntelligenceService {
  private static instance: VehicleIntelligenceService;

  private anomalyService = new AnomalyDetectionService();
  private healthService = new VehicleHealthService();
  private riskService = new RiskAnalysisService();
  private maintenanceService = new MaintenancePredictionService();
  private aiService = new IntelligenceAIService();
  private blockchainService = BlockchainService.getInstance();

  public static getInstance(): VehicleIntelligenceService {
    if (!VehicleIntelligenceService.instance) {
      VehicleIntelligenceService.instance = new VehicleIntelligenceService();
    }
    return VehicleIntelligenceService.instance;
  }

  /**
   * Generates a complete, evidence-backed Vehicle Intelligence Report
   */
  public async generateReport(vehicleIdOrPassportId: string): Promise<VehicleIntelligenceReport> {
    // 1. Fetch complete vehicle entity with all lifecycle domains
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        OR: [{ id: vehicleIdOrPassportId }, { passportId: vehicleIdOrPassportId }],
      },
      include: {
        currentOwner: true,
        serviceRecords: {
          orderBy: { serviceDate: 'desc' },
          include: { garage: { select: { name: true } } },
        },
        odometerRecords: {
          orderBy: { recordedAt: 'desc' },
        },
        accidentRecords: {
          orderBy: { accidentDate: 'desc' },
        },
        insuranceRecords: {
          orderBy: { startDate: 'desc' },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        ownershipHistory: {
          orderBy: { transferDate: 'desc' },
          include: {
            newOwner: { select: { name: true } },
            previousOwner: { select: { name: true } },
          },
        },
      },
    });

    if (!vehicle) {
      throw new Error(`Vehicle ${vehicleIdOrPassportId} not found in database`);
    }

    // 2. Fetch cryptographic ground truth from blockchain verification engine
    const fullVerificationReport = await this.blockchainService.verifyVehiclePassportFull(vehicle.id);

    // 3. Run Anomaly Detection Engine
    const anomalies = this.anomalyService.detectAnomalies({
      vehicle: vehicle as any,
      fullVerificationReport,
    });

    // 4. Run Vehicle Health Scoring Engine
    const health = this.healthService.evaluateHealth({
      vehicle: vehicle as any,
      fullVerificationReport,
      anomalies,
    });

    // 5. Run Risk Analysis Engine
    const risk = this.riskService.assessRisk({
      health,
      anomalies,
      fullVerificationReport,
    });

    // 6. Run Predictive Maintenance Engine
    const predictiveMaintenance = this.maintenanceService.predictMaintenance({
      vehicle,
      serviceRecords: vehicle.serviceRecords,
      odometerRecords: vehicle.odometerRecords,
    });

    // 7. Assemble Visual Evidence Graph
    const evidenceGraph = this.buildEvidenceGraph(vehicle, fullVerificationReport, anomalies);

    // 8. Assemble Preliminary Report Object
    const anomalyCounts = {
      totalCount: anomalies.length,
      criticalCount: anomalies.filter((a) => a.severity === 'CRITICAL').length,
      highCount: anomalies.filter((a) => a.severity === 'HIGH').length,
      mediumCount: anomalies.filter((a) => a.severity === 'MEDIUM').length,
      lowCount: anomalies.filter((a) => a.severity === 'LOW').length,
      items: anomalies,
    };

    const executiveSummary =
      `Vehicle Passport ${vehicle.passportId} (${vehicle.manufacturer} ${vehicle.model}) evaluates with ` +
      `Health Score ${health.overallScore}/100 (${health.status}) and ${risk.overallRiskLevel} risk profile. ` +
      `${anomalies.length === 0 ? 'Zero chronological or data discrepancies detected.' : `${anomalies.length} anomaly/anomalies flagged for review.`} ` +
      `${predictiveMaintenance.predictions.length} maintenance item(s) predicted.`;

    const report: VehicleIntelligenceReport = {
      vehicleId: vehicle.id,
      passportId: vehicle.passportId,
      vin: vehicle.vin,
      generatedAt: new Date().toISOString(),
      engineVersions: {
        healthEngine: VehicleHealthService.VERSION,
        riskEngine: RiskAnalysisService.VERSION,
        anomalyEngine: AnomalyDetectionService.VERSION,
        maintenanceEngine: MaintenancePredictionService.VERSION,
        ruleSetVersion: 'v1.0.0',
      },
      executiveSummary,
      health,
      risk,
      anomalies: anomalyCounts,
      predictiveMaintenance,
      evidenceGraph,
      rawEvidencePackage: null as any, // populated below
    };

    // 9. Generate Bounded AI Evidence Package
    report.rawEvidencePackage = this.aiService.createEvidencePackage(report);

    // 10. Persist Snapshot for Auditability & Quick Cache
    try {
      await prisma.vehicleIntelligenceSnapshot.create({
        data: {
          vehicleId: vehicle.id,
          healthScore: health.overallScore,
          healthStatus: health.status,
          riskLevel: risk.overallRiskLevel,
          riskScore: risk.overallRiskScore,
          anomalyCount: anomalies.length,
          integrityStatus: fullVerificationReport.hasTamper ? 'TAMPERED' : 'VERIFIED',
          engineVersion: 'v1.0.0',
          ruleVersion: 'v1.0.0',
          fullReportJson: JSON.stringify(report),
          status: 'CURRENT',
        },
      });

      // Audit Log
      await logAuditEvent({
        action: 'INTELLIGENCE_EVALUATED',
        vehicleId: vehicle.id,
        details: {
          passportId: vehicle.passportId,
          healthScore: health.overallScore,
          riskLevel: risk.overallRiskLevel,
          anomalyCount: anomalies.length,
        },
      });
    } catch (persistErr) {
      console.warn('⚠️ Could not persist intelligence snapshot:', persistErr);
    }

    return report;
  }

  /**
   * Natural Language Evidence Question Answering
   */
  public async askIntelligenceQuestion(params: {
    vehicleIdOrPassportId: string;
    question: string;
  }) {
    const report = await this.generateReport(params.vehicleIdOrPassportId);
    return this.aiService.answerQuestion({
      question: params.question,
      report,
    });
  }

  /**
   * Builds an interactive node-and-link graph representing the evidence trail
   */
  private buildEvidenceGraph(
    vehicle: any,
    fullVerificationReport: FullVehicleVerificationReport,
    anomalies: DetectedAnomaly[]
  ): EvidenceGraph {
    const nodes: EvidenceGraphNode[] = [];
    const links: EvidenceGraphLink[] = [];

    // Root node: Vehicle
    nodes.push({
      id: `VEH-${vehicle.id}`,
      label: `${vehicle.manufacturer} ${vehicle.model} (${vehicle.passportId})`,
      category: 'VEHICLE',
      status: fullVerificationReport.vehicleIdentity.isVerified ? 'VERIFIED' : 'TAMPERED',
      details: { vin: vehicle.vin, year: vehicle.manufacturingYear },
    });

    // Blockchain Anchor node
    nodes.push({
      id: `BLK-${vehicle.id}`,
      label: `Blockchain Anchor (${fullVerificationReport.network})`,
      category: 'BLOCKCHAIN',
      status: fullVerificationReport.hasTamper ? 'TAMPERED' : 'VERIFIED',
      details: { contract: fullVerificationReport.vehicleIdentity.blockchainVehicleId },
    });

    links.push({
      source: `VEH-${vehicle.id}`,
      target: `BLK-${vehicle.id}`,
      relationship: 'IMMUTABLE_ANCHOR',
      status: fullVerificationReport.vehicleIdentity.isVerified ? 'VERIFIED' : 'TAMPERED',
    });

    // Ownership node
    if (vehicle.ownershipHistory.length > 0) {
      const ownNodeId = `OWN-${vehicle.id}`;
      nodes.push({
        id: ownNodeId,
        label: `${vehicle.ownershipHistory.length} Ownership Transfer(s)`,
        category: 'OWNERSHIP',
        status: 'VERIFIED',
      });
      links.push({
        source: `VEH-${vehicle.id}`,
        target: ownNodeId,
        relationship: 'CUSTODY_TRAIL',
        status: 'VERIFIED',
      });
    }

    // Service Records nodes
    for (const s of vehicle.serviceRecords.slice(0, 3)) {
      const sNodeId = `SRV-${s.id}`;
      nodes.push({
        id: sNodeId,
        label: `${s.serviceType} (${s.mileage.toLocaleString()} km)`,
        category: 'SERVICE',
        status: 'VERIFIED',
        details: { date: s.serviceDate.toISOString().split('T')[0] },
      });
      links.push({
        source: `VEH-${vehicle.id}`,
        target: sNodeId,
        relationship: 'MAINTENANCE_EVENT',
        status: 'VERIFIED',
      });
    }

    // Odometer Records nodes
    for (const o of vehicle.odometerRecords.slice(0, 3)) {
      const oNodeId = `ODO-${o.id}`;
      const isOdoAnom = anomalies.some((a) => a.affectedRecordId === o.id);
      nodes.push({
        id: oNodeId,
        label: `${o.mileage.toLocaleString()} km (${o.sourceType})`,
        category: 'ODOMETER',
        status: isOdoAnom ? 'SUSPICIOUS' : 'VERIFIED',
        details: { date: o.recordedAt.toISOString().split('T')[0] },
      });
      links.push({
        source: `VEH-${vehicle.id}`,
        target: oNodeId,
        relationship: 'ODOMETER_LOG',
        status: isOdoAnom ? 'DISCREPANCY' : 'VERIFIED',
      });
    }

    // Document nodes
    for (const d of vehicle.documents.slice(0, 2)) {
      const dNodeId = `DOC-${d.id}`;
      nodes.push({
        id: dNodeId,
        label: `${d.title} (${d.documentType})`,
        category: 'DOCUMENT',
        status: d.consistencyStatus === 'CONSISTENT' ? 'VERIFIED' : 'UNVERIFIED',
        details: { cid: d.ipfsCid },
      });
      links.push({
        source: `VEH-${vehicle.id}`,
        target: dNodeId,
        relationship: 'CERTIFIED_PROOF',
        status: d.consistencyStatus === 'CONSISTENT' ? 'VERIFIED' : 'DISCREPANCY',
      });
    }

    return { nodes, links };
  }
}
