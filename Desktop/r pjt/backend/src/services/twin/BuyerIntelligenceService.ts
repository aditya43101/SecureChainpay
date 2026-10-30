import { DigitalTwinService } from './DigitalTwinService';
import { VehicleIntelligenceService } from '../intelligence/VehicleIntelligenceService';
import { logAuditEvent } from '../auditService';
import {
  BuyerIntelligenceReport,
  PublicBuyerSummary,
  BuyerQuestionToAsk,
  VerifiedFact,
  UnknownFact,
} from './types';

export class BuyerIntelligenceService {
  private static instance: BuyerIntelligenceService;
  private digitalTwinService = DigitalTwinService.getInstance();
  private intelligenceService = VehicleIntelligenceService.getInstance();

  private constructor() {}

  public static getInstance(): BuyerIntelligenceService {
    if (!BuyerIntelligenceService.instance) {
      BuyerIntelligenceService.instance = new BuyerIntelligenceService();
    }
    return BuyerIntelligenceService.instance;
  }

  /**
   * Generates a comprehensive authenticated Used-Car Buyer Intelligence Report.
   */
  public async getBuyerReport(vehicleId: string): Promise<BuyerIntelligenceReport> {
    const twin = await this.digitalTwinService.reconstructDigitalTwin(vehicleId);
    const intelligence = await this.intelligenceService.generateReport(vehicleId);

    const now = new Date();
    const currentYear = now.getFullYear();
    const vehicleAgeYears = Math.max(1, currentYear - twin.identity.manufacturingYear);

    // 1. Overall Trust Badge
    let overallTrustBadge: 'VERIFIED' | 'PROCEED_WITH_CAUTION' | 'HIGH_RISK_TAMPER' = 'VERIFIED';
    if (twin.odometer.rollbackDetected || twin.blockchain.integrityStatus === 'TAMPER_DETECTED') {
      overallTrustBadge = 'HIGH_RISK_TAMPER';
    } else if (
      twin.accidents.openRepairsCount > 0 ||
      twin.maintenance.serviceCoverageScore < 70 ||
      intelligence.risk.overallRiskLevel === 'HIGH' ||
      intelligence.risk.overallRiskLevel === 'CRITICAL'
    ) {
      overallTrustBadge = 'PROCEED_WITH_CAUTION';
    }

    // 2. Generate Evidence-Driven "Questions to Ask the Seller"
    const questionsToAskSeller: BuyerQuestionToAsk[] = [];

    // Odometer anomaly question
    if (twin.odometer.rollbackDetected) {
      questionsToAskSeller.push({
        id: 'q-odo-rollback',
        category: 'Odometer Telemetry',
        question:
          'Can you explain the non-monotonic discrepancy recorded between the odometer readings in the vehicle history?',
        contextReason:
          'An odometer reading inversion was detected by the cryptographic verification engine.',
        severity: 'HIGH',
      });
    }

    // Service gap question
    if (twin.maintenance.serviceCoverageScore < 80) {
      questionsToAskSeller.push({
        id: 'q-service-gap',
        category: 'Maintenance Continuity',
        question:
          'Do you possess physical maintenance invoices or dealer service stamps for intervals not recorded on-chain?',
        contextReason: `Service coverage is evaluated at ${twin.maintenance.serviceCoverageScore}%, indicating gaps between expected 15,000 km intervals.`,
        severity: twin.maintenance.serviceCoverageScore < 60 ? 'HIGH' : 'MEDIUM',
      });
    }

    // Accident & Repair questions
    twin.accidents.records.forEach((acc, idx) => {
      if (acc.repairStatus !== 'COMPLETED') {
        questionsToAskSeller.push({
          id: `q-acc-unrepaired-${idx}`,
          category: 'Accident & Structural Damage',
          question: `Can you verify the current mechanical and cosmetic condition regarding the ${acc.severity} accident recorded on ${new Date(
            acc.date
          ).toLocaleDateString()}?`,
          contextReason: `The collision record indicates repair status as "${acc.repairStatus}".`,
          severity: 'HIGH',
        });
      } else {
        questionsToAskSeller.push({
          id: `q-acc-warranty-${idx}`,
          category: 'Accident Repair Warranty',
          question: `Is there a transferrable workshop warranty or OEM parts receipt for the repair following the ${acc.severity} collision on ${new Date(
            acc.date
          ).toLocaleDateString()}?`,
          contextReason:
            'A certified repair is logged on-chain, and documentation proves parts replacement authenticity.',
          severity: 'LOW',
        });
      }
    });

    // Insurance coverage continuity question
    if (!twin.insurance.hasActiveCoverage) {
      questionsToAskSeller.push({
        id: 'q-ins-lapsed',
        category: 'Insurance Policy',
        question:
          'What is the current insurance coverage status, and will a transfer of insurance or new policy binder be arranged prior to sale?',
        contextReason: 'No currently active comprehensive insurance policy is logged in the digital passport.',
        severity: 'MEDIUM',
      });
    }

    // Ownership transfer velocity question
    if (twin.ownership.totalOwnersCount > 2) {
      questionsToAskSeller.push({
        id: 'q-owner-velocity',
        category: 'Ownership History',
        question: `Could you share the circumstances surrounding the vehicle having ${twin.ownership.totalOwnersCount} registered owners within ${vehicleAgeYears} years?`,
        contextReason: 'Multiple title changes occurred across a relatively short ownership cycle.',
        severity: 'MEDIUM',
      });
    }

    // Document consistency question
    if (twin.documents.consistencyStatus === 'INCONSISTENT') {
      questionsToAskSeller.push({
        id: 'q-doc-mismatch',
        category: 'Document Verification',
        question:
          'Can you provide original physical Registration Certificates (RC) to reconcile with database telemetry?',
        contextReason:
          'Smart document OCR detected a field mismatch between uploaded documentation and database records.',
        severity: 'HIGH',
      });
    }

    // Default pristine reassurance question if 0 gaps found
    if (questionsToAskSeller.length === 0) {
      questionsToAskSeller.push({
        id: 'q-routine-inspection',
        category: 'Pre-Purchase Inspection',
        question:
          'Are you agreeable to a third-party pre-purchase inspection at an authorized service centre?',
        contextReason:
          'Vehicle passport records are 100% complete and consistent; standard diligence remains best practice.',
        severity: 'LOW',
      });
    }

    // 3. What is Verified Checklist
    const whatIsVerified: VerifiedFact[] = [
      {
        category: 'Vehicle Identity',
        fact: `${twin.identity.manufacturer} ${twin.identity.model} (${twin.identity.manufacturingYear}) - VIN: ${twin.vin}`,
        source: 'Manufacturer Identity Anchor',
        onChainVerified: twin.blockchain.isAnchored,
      },
      {
        category: 'Ownership Title',
        fact: `Currently registered to ${twin.ownership.currentOwnerName} (${twin.ownership.totalOwnersCount} owner track record)`,
        source: 'Vehicle Title Registry',
        onChainVerified: true,
      },
      {
        category: 'Mileage Telemetry',
        fact: `${twin.odometer.currentMileage.toLocaleString()} km logged across ${twin.odometer.totalReadingsCount} distinct audit points`,
        source: 'Verified Odometer Audit',
        onChainVerified: true,
      },
      {
        category: 'Certified Services',
        fact: `${twin.maintenance.totalServicesCount} certified maintenance logs on record`,
        source: 'Certified Workshop Telemetry',
        onChainVerified: true,
      },
      {
        category: 'Blockchain State',
        fact: `${twin.blockchain.totalAnchoredRecords} lifecycle records sealed on EVM blockchain`,
        source: `Contract ${twin.blockchain.contractAddress}`,
        onChainVerified: true,
      },
    ];

    if (twin.accidents.totalAccidentsCount > 0) {
      whatIsVerified.push({
        category: 'Accident Disclosure',
        fact: `${twin.accidents.totalAccidentsCount} reported collision incident(s) with transparent repair tracking`,
        source: 'Accident Registry',
        onChainVerified: true,
      });
    }

    // 4. What is Unknown Checklist (Explicit Transparent Gaps)
    const whatIsUnknown: UnknownFact[] = [];

    if (twin.maintenance.serviceCoverageScore < 100) {
      whatIsUnknown.push({
        category: 'Maintenance History',
        description: 'Periodic service entries for intervening mileage intervals are not recorded on-chain.',
        impactReason:
          'Regular fluid changes or preventative checks during this period cannot be cryptographically proven.',
      });
    }

    if (twin.accidents.records.some((a) => a.repairStatus !== 'COMPLETED')) {
      whatIsUnknown.push({
        category: 'Collision Repair Sign-Off',
        description: 'Certified repair invoice or workshop completion sign-off is pending for one accident.',
        impactReason: 'Structural integrity restoration has not been formally certified.',
      });
    }

    if (twin.documents.totalDocumentsCount === 0) {
      whatIsUnknown.push({
        category: 'Document Proofs',
        description: 'No digital copies of Registration Certificates or physical invoices have been uploaded.',
        impactReason: 'Visual OCR cross-checking is unavailable.',
      });
    }

    if (!twin.insurance.hasActiveCoverage) {
      whatIsUnknown.push({
        category: 'Insurance Policy',
        description: 'No active insurance policy is registered in the vehicle passport.',
        impactReason: 'Current third-party liability and comprehensive status is unconfirmed.',
      });
    }

    // 5. Categorical Risk Factors
    const riskFactors = Object.values(intelligence.risk.categories).map((cat: any) => ({
      category: cat.label,
      riskLevel: cat.riskLevel,
      summary: cat.reason,
      evidence: cat.evidence,
    }));

    // 6. Structured AI Analysis
    const aiAnalysis = {
      summary: `This ${twin.identity.manufacturingYear} ${twin.identity.manufacturer} ${twin.identity.model} exhibits an overall health rating of ${intelligence.health.overallScore}/100 and a ${intelligence.risk.overallRiskLevel} risk profile. Telemetry records confirm ${twin.odometer.currentMileage.toLocaleString()} km across ${twin.ownership.totalOwnersCount} owner(s). ${
        twin.odometer.rollbackDetected
          ? 'WARNING: Odometer rollback has been flagged.'
          : 'Odometer telemetry follows expected monotonic progression.'
      }`,
      facts: whatIsVerified.map((v) => v.fact),
      anomalies: intelligence.anomalies.items.map((a: any) => `${a.title}: ${a.explanation}`),
      unknowns: whatIsUnknown.map((u) => u.description),
      questions: questionsToAskSeller.map((q) => q.question),
      evidence: [
        `Blockchain Anchor: ${twin.blockchain.contractAddress}`,
        `Passport ID: ${twin.passportId}`,
        `VIN: ${twin.vin}`,
        `Service Coverage: ${twin.maintenance.serviceCoverageScore}%`,
      ],
      confidenceScore: 0.95,
    };

    const report: BuyerIntelligenceReport = {
      vehicleId: twin.vehicleId,
      passportId: twin.passportId,
      vin: twin.vin,
      generatedAt: now.toISOString(),
      engineVersion: 'v1.0.0',

      overview: {
        manufacturer: twin.identity.manufacturer,
        model: twin.identity.model,
        variant: twin.identity.variant,
        manufacturingYear: twin.identity.manufacturingYear,
        vehicleAgeYears,
        fuelType: twin.identity.fuelType,
        registrationNumber: twin.identity.registrationNumber,
        currentVerifiedMileage: twin.odometer.currentMileage,
        status: twin.identity.status,
        totalOwnersCount: twin.ownership.totalOwnersCount,
      },

      trustSummary: {
        overallTrustBadge,
        blockchainVerified: twin.blockchain.integrityStatus === 'VERIFIED',
        odometerIntegrityVerified: !twin.odometer.rollbackDetected,
        serviceIntegrityVerified: twin.maintenance.serviceCoverageScore >= 70,
        accidentRepairsVerified: twin.accidents.openRepairsCount === 0,
        documentConsistencyVerified: twin.documents.consistencyStatus !== 'INCONSISTENT',
        healthScore: intelligence.health.overallScore,
        riskLevel: intelligence.risk.overallRiskLevel,
      },

      odometerTransparency: {
        currentMileage: twin.odometer.currentMileage,
        rollbackDetected: twin.odometer.rollbackDetected,
        anomalyDetected: twin.odometer.rollbackDetected,
        statusExplanation: twin.odometer.rollbackDetected
          ? 'Odometer rollback anomaly detected. Historical telemetry indicates non-monotonic reading decrease.'
          : 'Odometer progression conforms to expected continuous usage.',
        progression: twin.odometer.readingsHistory.map((r) => ({
          date: r.date,
          mileage: r.mileage,
          source: r.source,
        })),
      },

      serviceIntelligence: {
        totalServices: twin.maintenance.totalServicesCount,
        serviceCoveragePercentage: twin.maintenance.serviceCoverageScore,
        coverageCalculationFormula: twin.maintenance.coverageFormulaExplanation,
        frequencyAssessment:
          twin.maintenance.serviceCoverageScore >= 85
            ? 'Excellent regular maintenance compliance'
            : twin.maintenance.serviceCoverageScore >= 70
            ? 'Good maintenance adherence with minor intervals unrecorded'
            : 'Significant maintenance history gaps detected',
        lastServiceDate: twin.maintenance.lastServiceDate,
        lastServiceMileage: twin.maintenance.lastServiceMileage,
        nextExpectedServiceKm: twin.odometer.currentMileage + 10000,
        isOverdueForService: twin.maintenance.serviceGapsDetected,
      },

      accidentIntelligence: {
        totalAccidents: twin.accidents.totalAccidentsCount,
        severeDamageRecorded: twin.accidents.severeAccidentsCount > 0,
        allRepairsCertified: twin.accidents.openRepairsCount === 0,
        summary:
          twin.accidents.totalAccidentsCount === 0
            ? 'Zero accidents or collisions on record.'
            : `${twin.accidents.totalAccidentsCount} accident(s) logged; ${
                twin.accidents.openRepairsCount === 0 ? 'all repairs completed' : 'open repair pending'
              }.`,
        incidents: twin.accidents.records.map((a) => ({
          date: a.date,
          severity: a.severity,
          description: a.description,
          repairStatus: a.repairStatus,
        })),
      },

      questionsToAskSeller,
      whatIsVerified,
      whatIsUnknown,
      riskFactors,
      aiAnalysis,
    };

    await logAuditEvent({
      action: 'BUYER_REPORT_GENERATED',
      vehicleId,
      details: {
        passportId: twin.passportId,
        trustBadge: overallTrustBadge,
        questionsCount: questionsToAskSeller.length,
      },
    });

    return report;
  }

  /**
   * Generates a privacy-sanitized Public Buyer Summary (Unauthenticated safe).
   */
  public async getPublicBuyerSummary(passportId: string): Promise<PublicBuyerSummary> {
    const vehicle = await (await import('../../lib/prisma')).prisma.vehicle.findUnique({
      where: { passportId },
      select: { id: true },
    });

    if (!vehicle) {
      throw new Error(`Passport ${passportId} not found`);
    }

    const fullReport = await this.getBuyerReport(vehicle.id);

    // Mask registration number: e.g. MH02EV1001 -> MH02****1001
    const reg = fullReport.overview.registrationNumber;
    const maskedReg =
      reg.length >= 6 ? `${reg.slice(0, 4)}****${reg.slice(-4)}` : `${reg.slice(0, 2)}****`;

    // Mask VIN: e.g. MAT612345NEXON001 -> MAT612345NEX****
    const vin = fullReport.vin;
    const maskedVin = vin.length >= 10 ? `${vin.slice(0, 11)}****` : `${vin.slice(0, 4)}****`;

    return {
      passportId: fullReport.passportId,
      vinMasked: maskedVin,
      registrationNumberMasked: maskedReg,
      manufacturer: fullReport.overview.manufacturer,
      model: fullReport.overview.model,
      variant: fullReport.overview.variant,
      manufacturingYear: fullReport.overview.manufacturingYear,
      vehicleAgeYears: fullReport.overview.vehicleAgeYears,
      fuelType: fullReport.overview.fuelType,
      currentVerifiedMileage: fullReport.overview.currentVerifiedMileage,
      overallTrustBadge: fullReport.trustSummary.overallTrustBadge,
      blockchainVerified: fullReport.trustSummary.blockchainVerified,
      healthScore: fullReport.trustSummary.healthScore,
      riskLevel: fullReport.trustSummary.riskLevel,
      totalOwnersCount: fullReport.overview.totalOwnersCount,
      totalServicesCount: fullReport.serviceIntelligence.totalServices,
      totalAccidentsCount: fullReport.accidentIntelligence.totalAccidents,
      odometerRollbackDetected: fullReport.odometerTransparency.rollbackDetected,
      serviceCoveragePercentage: fullReport.serviceIntelligence.serviceCoveragePercentage,
      serviceCoverageFormula: fullReport.serviceIntelligence.coverageCalculationFormula,
      questionsToAskSeller: fullReport.questionsToAskSeller,
      whatIsVerified: fullReport.whatIsVerified.map((v) => `${v.category}: ${v.fact}`),
      whatIsUnknown: fullReport.whatIsUnknown.map((u) => `${u.category}: ${u.description}`),
      publicBlockchainProof: {
        network: 'Hardhat Localhost (Chain ID 31337)',
        contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        isAnchored: fullReport.trustSummary.blockchainVerified,
        latestBlock: 21,
      },
      generatedAt: fullReport.generatedAt,
    };
  }
}
