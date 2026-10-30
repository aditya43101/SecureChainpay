import { prisma } from '../../lib/prisma';
import { BlockchainService } from '../../blockchain/services/blockchainService';
import {
  generateInsuranceClaimHash,
  CanonicalInsuranceClaimInput,
} from '../../blockchain/utils/canonicalHash';
import {
  InsuranceIntelligenceReport,
  InsuranceClaimDTO,
  CreateInsuranceClaimInput,
} from './types';
import { logAuditEvent } from '../auditService';

export class InsuranceIntelligenceService {
  private static instance: InsuranceIntelligenceService;

  public static getInstance(): InsuranceIntelligenceService {
    if (!InsuranceIntelligenceService.instance) {
      InsuranceIntelligenceService.instance = new InsuranceIntelligenceService();
    }
    return InsuranceIntelligenceService.instance;
  }

  /**
   * Generates a comprehensive insurance intelligence and accident correlation report
   */
  public async getInsuranceIntelligence(vehicleId: string): Promise<InsuranceIntelligenceReport> {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        insuranceRecords: {
          include: {
            provider: true,
            claims: {
              include: {
                accidentRecord: true,
              },
              orderBy: { claimDate: 'desc' },
            },
          },
          orderBy: { startDate: 'desc' },
        },
        accidentRecords: {
          include: {
            insuranceClaims: true,
          },
          orderBy: { accidentDate: 'desc' },
        },
      },
    });

    if (!vehicle) {
      throw new Error(`Vehicle ${vehicleId} not found`);
    }

    const now = new Date();
    const activePolicyRecord = vehicle.insuranceRecords.find(
      (p) => p.status === 'ACTIVE' || (new Date(p.endDate) >= now && new Date(p.startDate) <= now)
    );

    let continuity: 'CONTINUOUS' | 'GAPS_DETECTED' | 'EXPIRED' | 'UNINSURED' = 'UNINSURED';
    if (vehicle.insuranceRecords.length === 0) {
      continuity = 'UNINSURED';
    } else if (activePolicyRecord) {
      continuity = 'CONTINUOUS';
    } else {
      continuity = 'EXPIRED';
    }

    // Flatten all claims across policies
    const allClaims: InsuranceClaimDTO[] = [];
    let totalApproved = 0;

    for (const policy of vehicle.insuranceRecords) {
      for (const claim of policy.claims) {
        if (claim.approvedAmount) {
          totalApproved += claim.approvedAmount;
        }

        allClaims.push({
          id: claim.id,
          insuranceRecordId: claim.insuranceRecordId,
          policyReference: policy.policyReference,
          accidentRecordId: claim.accidentRecordId,
          claimNumber: claim.claimNumber,
          claimDate: claim.claimDate.toISOString(),
          claimAmount: claim.claimAmount,
          approvedAmount: claim.approvedAmount,
          claimStatus: claim.claimStatus,
          description: claim.description,
          payoutDate: claim.payoutDate ? claim.payoutDate.toISOString() : null,
          accidentDetails: claim.accidentRecord
            ? {
                date: claim.accidentRecord.accidentDate.toISOString(),
                severity: claim.accidentRecord.severity,
                description: claim.accidentRecord.description,
                repairStatus: claim.accidentRecord.repairStatus,
              }
            : null,
          recordHash: claim.recordHash,
          blockchainTxHash: claim.blockchainTxHash,
          blockNumber: claim.blockNumber,
          createdAt: claim.createdAt.toISOString(),
        });
      }
    }

    // Accident to Claim Correlation
    const totalAccidents = vehicle.accidentRecords.length;
    const linkedAccidents = vehicle.accidentRecords.filter(
      (a) => a.insuranceClaims && a.insuranceClaims.length > 0
    ).length;
    const unlinkedAccidents = totalAccidents - linkedAccidents;

    let correlationStatus: 'ALL_LINKED' | 'PARTIAL_LINKAGE' | 'NO_CLAIMS' | 'UNLINKED_ACCIDENTS' = 'NO_CLAIMS';
    if (totalAccidents === 0 && allClaims.length === 0) {
      correlationStatus = 'NO_CLAIMS';
    } else if (totalAccidents > 0 && linkedAccidents === totalAccidents) {
      correlationStatus = 'ALL_LINKED';
    } else if (unlinkedAccidents > 0 && linkedAccidents > 0) {
      correlationStatus = 'PARTIAL_LINKAGE';
    } else if (unlinkedAccidents > 0 && linkedAccidents === 0) {
      correlationStatus = 'UNLINKED_ACCIDENTS';
    }

    // Factual risk observations
    const riskObservations: string[] = [];
    if (unlinkedAccidents > 0) {
      riskObservations.push(`${unlinkedAccidents} recorded collision(s) have no associated insurance claim reference.`);
    }
    if (allClaims.some((c) => c.claimStatus === 'UNDER_REVIEW')) {
      riskObservations.push('There is currently an active insurance claim under investigation.');
    }
    if (continuity === 'EXPIRED' || continuity === 'UNINSURED') {
      riskObservations.push('Vehicle currently lacks active verified third-party/comprehensive insurance coverage.');
    }
    if (totalApproved > 5000) {
      riskObservations.push(`Substantial aggregate insurance claim payouts ($${totalApproved.toLocaleString()}) recorded.`);
    }
    if (riskObservations.length === 0) {
      riskObservations.push('Clean insurance history with continuous verified coverage and zero unresolved claims.');
    }

    return {
      vehicleId: vehicle.id,
      passportId: vehicle.passportId,
      totalPolicies: vehicle.insuranceRecords.length,
      activePolicy: activePolicyRecord
        ? {
            policyReference: activePolicyRecord.policyReference,
            providerName: activePolicyRecord.provider.name,
            startDate: activePolicyRecord.startDate.toISOString(),
            endDate: activePolicyRecord.endDate.toISOString(),
            status: activePolicyRecord.status,
            coverageType: activePolicyRecord.coverageType,
          }
        : null,
      coverageContinuity: continuity,
      totalClaimsCount: allClaims.length,
      totalClaimAmountApproved: totalApproved,
      claims: allClaims,
      accidentCorrelation: {
        totalAccidents,
        linkedToClaimsCount: linkedAccidents,
        unlinkedAccidentsCount: unlinkedAccidents,
        correlationStatus,
      },
      riskObservations,
    };
  }

  /**
   * Files an insurance claim against an existing policy and optionally links to a recorded accident
   */
  public async fileClaim(
    vehicleId: string,
    insuranceRecordId: string,
    input: CreateInsuranceClaimInput
  ): Promise<InsuranceClaimDTO> {
    const policy = await prisma.insuranceRecord.findUnique({
      where: { id: insuranceRecordId },
      include: { vehicle: true },
    });

    if (!policy) {
      throw new Error(`Insurance policy ${insuranceRecordId} not found`);
    }

    if (policy.vehicleId !== vehicleId) {
      throw new Error(`Policy ${insuranceRecordId} does not belong to vehicle ${vehicleId}`);
    }

    let accidentRecord = null;
    if (input.accidentRecordId) {
      accidentRecord = await prisma.accidentRecord.findUnique({
        where: { id: input.accidentRecordId },
      });
      if (!accidentRecord || accidentRecord.vehicleId !== vehicleId) {
        throw new Error(`Accident record ${input.accidentRecordId} does not belong to vehicle ${vehicleId}`);
      }
    }

    const claimDate = new Date(input.claimDate || (input as any).incidentDate || new Date());
    const count = await prisma.insuranceClaimRecord.count();
    const claimNumber = input.claimNumber || `CLM-${claimDate.getFullYear()}-${String(count + 1).padStart(5, '0')}`;
    const claimStatus = input.claimStatus || 'SUBMITTED';
    const claimAmount = input.claimAmount ?? (input as any).amountClaimed ?? null;
    const approvedAmount = input.approvedAmount ?? (input as any).amountSettled ?? null;
    const payoutDateVal = input.payoutDate || (input as any).settlementDate || null;

    // Canonical Hashing
    const canonicalInput: CanonicalInsuranceClaimInput = {
      blockchainVehicleId: policy.vehicle.blockchainVehicleId || policy.vehicle.id,
      claimNumber,
      claimDate,
      claimAmount,
      claimStatus,
    };

    const recordHash = generateInsuranceClaimHash(canonicalInput);

    let blockchainRecordId: string | null = null;
    let blockchainTxHash: string | null = null;
    let blockNumber: number | null = null;

    if (policy.vehicle.blockchainVehicleId) {
      try {
        const anchor = await BlockchainService.getInstance().anchorRecord({
          vehicleId: policy.vehicle.id,
          recordType: 'INSURANCE_CLAIM',
          recordHash,
        });
        blockchainRecordId = anchor.recordId;
        blockchainTxHash = anchor.txHash;
        blockNumber = anchor.blockNumber;
      } catch (err) {
        console.warn('⚠️ Blockchain anchoring failed for Insurance Claim:', err);
      }
    }

    const claim = await prisma.insuranceClaimRecord.create({
      data: {
        insuranceRecordId: policy.id,
        accidentRecordId: input.accidentRecordId || null,
        claimNumber,
        claimDate,
        claimAmount,
        approvedAmount,
        claimStatus,
        description: input.description,
        payoutDate: payoutDateVal ? new Date(payoutDateVal) : null,
        recordHash,
        blockchainRecordId,
        blockchainTxHash,
        blockNumber,
      },
      include: {
        accidentRecord: true,
      },
    });

    // If linked to accident, also update the accident's insuranceClaimId field for backwards compatibility
    if (input.accidentRecordId) {
      await prisma.accidentRecord.update({
        where: { id: input.accidentRecordId },
        data: { insuranceClaimId: claimNumber },
      });
    }

    await logAuditEvent({
      action: 'INSURANCE_CLAIM_FILED',
      vehicleId: policy.vehicleId,
      details: {
        claimNumber,
        recordHash,
        blockchainTxHash,
      },
    });

    return {
      id: claim.id,
      insuranceRecordId: claim.insuranceRecordId,
      policyReference: policy.policyReference,
      accidentRecordId: claim.accidentRecordId,
      claimNumber: claim.claimNumber,
      claimDate: claim.claimDate.toISOString(),
      claimAmount: claim.claimAmount,
      approvedAmount: claim.approvedAmount,
      claimStatus: claim.claimStatus,
      description: claim.description,
      payoutDate: claim.payoutDate ? claim.payoutDate.toISOString() : null,
      accidentDetails: claim.accidentRecord
        ? {
            date: claim.accidentRecord.accidentDate.toISOString(),
            severity: claim.accidentRecord.severity,
            description: claim.accidentRecord.description,
            repairStatus: claim.accidentRecord.repairStatus,
          }
        : null,
      recordHash: claim.recordHash,
      blockchainTxHash: claim.blockchainTxHash,
      blockNumber: claim.blockNumber,
      createdAt: claim.createdAt.toISOString(),
    };
  }
}
