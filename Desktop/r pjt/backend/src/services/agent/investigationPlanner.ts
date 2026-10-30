import { toolRegistry } from './toolRegistry';
import { InvestigationTypeEnum, InvestigationTargetType } from './types';

export interface PlannedStep {
  toolName: string;
  input: Record<string, any>;
  reason: string;
}

export class InvestigationPlanner {
  private static instance: InvestigationPlanner;

  public static getInstance(): InvestigationPlanner {
    if (!InvestigationPlanner.instance) {
      InvestigationPlanner.instance = new InvestigationPlanner();
    }
    return InvestigationPlanner.instance;
  }

  /**
   * Generates a deterministic, bounded investigative plan
   */
  public generatePlan(params: {
    targetType: InvestigationTargetType;
    targetId: string;
    vehicleId?: string;
    investigationType: InvestigationTypeEnum;
    maxSteps?: number;
  }): PlannedStep[] {
    const { targetType, targetId, investigationType } = params;
    const vehicleId = params.vehicleId || (targetType === 'VEHICLE' ? targetId : undefined);
    const maxSteps = Math.min(params.maxSteps || 20, 20);

    const steps: PlannedStep[] = [];

    // All vehicle investigations start by retrieving the vehicle passport if vehicleId is available
    if (vehicleId) {
      steps.push({
        toolName: 'get_vehicle_passport',
        input: { vehicleId },
        reason: 'Establish ground-truth vehicle passport identity, status, and ownership.',
      });
    }

    switch (investigationType) {
      case 'ODOMETER_ROLLBACK': {
        if (vehicleId) {
          steps.push({
            toolName: 'get_odometer_timeline',
            input: { vehicleId },
            reason: 'Retrieve chronological mileage telemetry to detect drops or jumps.',
          });
          steps.push({
            toolName: 'get_service_history',
            input: { vehicleId, limit: 25 },
            reason: 'Cross-reference garage service logs and recorded service mileage.',
          });
          steps.push({
            toolName: 'get_blockchain_anchor_status',
            input: { vehicleId },
            reason: 'Verify on-chain smart contract commitments for odometer readings.',
          });
          steps.push({
            toolName: 'get_vehicle_fraud_findings',
            input: { vehicleId },
            reason: 'Check existing Phase 7 fraud engine findings for this vehicle.',
          });
          steps.push({
            toolName: 'compare_record_timeline',
            input: { vehicleId },
            reason: 'Verify temporal chronology between services and odometer recordings.',
          });
        }
        break;
      }

      case 'OWNERSHIP_IDENTITY': {
        if (vehicleId) {
          steps.push({
            toolName: 'get_vehicle_identity_history',
            input: { vehicleId },
            reason: 'Retrieve factory birth certificate specifications and battery records.',
          });
          steps.push({
            toolName: 'get_ownership_timeline',
            input: { vehicleId },
            reason: 'Audit title transfer progression and past ownership parties.',
          });
          steps.push({
            toolName: 'get_document_metadata',
            input: { vehicleId },
            reason: 'Retrieve registration and title documents uploaded to IPFS/local storage.',
          });
          steps.push({
            toolName: 'get_blockchain_anchor_status',
            input: { vehicleId },
            reason: 'Audit on-chain root ownership and registration anchoring.',
          });
          steps.push({
            toolName: 'get_vehicle_fraud_findings',
            input: { vehicleId },
            reason: 'Check for VIN identity conflicts or duplicate registration findings.',
          });
        }
        break;
      }

      case 'DOCUMENT_INTEGRITY': {
        if (vehicleId) {
          steps.push({
            toolName: 'get_document_metadata',
            input: { vehicleId },
            reason: 'Enumerate uploaded documents and cryptographic file hashes.',
          });
          steps.push({
            toolName: 'get_blockchain_anchor_status',
            input: { vehicleId },
            reason: 'Check if document hashes are anchored on blockchain or in batches.',
          });
          steps.push({
            toolName: 'get_vehicle_fraud_findings',
            input: { vehicleId },
            reason: 'Inspect Phase 7 findings for document cloning or OCR inconsistencies.',
          });
        } else if (targetType === 'DOCUMENT') {
          steps.push({
            toolName: 'verify_document_integrity',
            input: { documentId: targetId },
            reason: 'Directly audit OCR fields against vehicle database records.',
          });
        }
        break;
      }

      case 'FRAUD_GRAPH': {
        if (vehicleId) {
          const vehicleNodeKey = `VEHICLE:${vehicleId}`;
          steps.push({
            toolName: 'get_related_graph_entities',
            input: { nodeKey: vehicleNodeKey, depth: 2 },
            reason: 'Traverse 2-hop neighborhood in the Fraud Intelligence Graph.',
          });
          steps.push({
            toolName: 'get_related_graph_findings',
            input: { vehicleId },
            reason: 'Discover cross-vehicle findings connected through common entities.',
          });
          steps.push({
            toolName: 'get_vehicle_fraud_findings',
            input: { vehicleId },
            reason: 'Retrieve local findings evaluated for this vehicle.',
          });
        }
        break;
      }

      case 'MULTI_SIGNAL': {
        if (vehicleId) {
          steps.push({
            toolName: 'get_vehicle_identity_history',
            input: { vehicleId },
            reason: 'Audit factory specifications and battery pack passport.',
          });
          steps.push({
            toolName: 'get_odometer_timeline',
            input: { vehicleId },
            reason: 'Audit odometer telemetry sequence.',
          });
          steps.push({
            toolName: 'get_service_history',
            input: { vehicleId, limit: 25 },
            reason: 'Inspect service records and servicing garage accreditation.',
          });
          steps.push({
            toolName: 'get_document_metadata',
            input: { vehicleId },
            reason: 'Retrieve document proofs and OCR consistency reports.',
          });
          steps.push({
            toolName: 'get_blockchain_anchor_status',
            input: { vehicleId },
            reason: 'Verify Hardhat EVM smart contract anchor status.',
          });
          steps.push({
            toolName: 'get_merkle_proof_status',
            input: { recordId: vehicleId },
            reason: 'Check Phase 6 Merkle batch inclusion proofs.',
          });
          steps.push({
            toolName: 'get_vehicle_fraud_findings',
            input: { vehicleId },
            reason: 'Inspect Phase 7 deterministic rule findings.',
          });
          steps.push({
            toolName: 'get_related_graph_findings',
            input: { vehicleId },
            reason: 'Discover connected cross-entity anomalies.',
          });
          steps.push({
            toolName: 'compare_record_timeline',
            input: { vehicleId },
            reason: 'Cross-check multi-source timestamps for chronology violations.',
          });
        }
        break;
      }

      case 'GENERAL':
      default: {
        if (vehicleId) {
          steps.push({
            toolName: 'get_odometer_timeline',
            input: { vehicleId },
            reason: 'Retrieve odometer readings.',
          });
          steps.push({
            toolName: 'get_service_history',
            input: { vehicleId, limit: 10 },
            reason: 'Retrieve recent service records.',
          });
          steps.push({
            toolName: 'get_blockchain_anchor_status',
            input: { vehicleId },
            reason: 'Check blockchain anchor status.',
          });
          steps.push({
            toolName: 'get_vehicle_fraud_findings',
            input: { vehicleId },
            reason: 'Check existing fraud findings.',
          });
        }
        break;
      }
    }

    // Strict validation against registered tool allowlist & budget truncation
    const allowlistedToolNames = new Set(toolRegistry.getToolNames());
    const validatedSteps = steps.filter((step) => {
      const isAllowed = allowlistedToolNames.has(step.toolName);
      if (!isAllowed) {
        console.warn(`[InvestigationPlanner] Rejected un-allowlisted tool: ${step.toolName}`);
      }
      return isAllowed;
    });

    return validatedSteps.slice(0, maxSteps);
  }

  /**
   * Validates and filters AI-suggested steps against the strict tool registry allowlist
   */
  public sanitizeProposedSteps(
    proposedSteps: Array<{ toolName: string; input: Record<string, any>; reason?: string }>,
    maxSteps: number = 20
  ): PlannedStep[] {
    const allowlisted = new Set(toolRegistry.getToolNames());
    const valid: PlannedStep[] = [];

    for (const p of proposedSteps) {
      if (allowlisted.has(p.toolName)) {
        valid.push({
          toolName: p.toolName,
          input: p.input || {},
          reason: p.reason || 'AI proposed investigative follow-up step',
        });
      } else {
        console.warn(`[InvestigationPlanner] AI proposed unknown/unpermitted tool: "${p.toolName}". REJECTED.`);
      }
      if (valid.length >= maxSteps) break;
    }

    return valid;
  }
}

export const investigationPlanner = InvestigationPlanner.getInstance();
