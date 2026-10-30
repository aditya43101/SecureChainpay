import { prisma } from '../../lib/prisma';
import { DigitalTwinService } from './DigitalTwinService';
import {
  ScenarioSimulationRequest,
  ScenarioSimulationResultDTO,
  ScenarioDiffItem,
  TwinScenarioType,
} from './autonomousTwinTypes';

export class TwinScenarioService {
  private static instance: TwinScenarioService;
  private twinService = DigitalTwinService.getInstance();

  private constructor() {}

  public static getInstance(): TwinScenarioService {
    if (!TwinScenarioService.instance) {
      TwinScenarioService.instance = new TwinScenarioService();
    }
    return TwinScenarioService.instance;
  }

  /**
   * Executes a bounded hypothetical what-if scenario simulation without mutating
   * any authoritative records or triggering blockchain operations.
   */
  public async simulateScenario(
    vehicleId: string,
    userId: string,
    request: ScenarioSimulationRequest
  ): Promise<ScenarioSimulationResultDTO> {
    const { scenarioType, inputs } = request;

    // 1. Fetch current baseline Digital Vehicle Twin
    const baseTwin = await this.twinService.reconstructDigitalTwin(vehicleId);
    const baseVersion = `BASE-TWIN-v10-${baseTwin.reconstructedAt}`;

    let diffs: ScenarioDiffItem[] = [];
    let assumptions: string[] = [];
    let explanation = '';
    const warningFlags: string[] = [];

    let projectedHealthScore = baseTwin.intelligence.healthScore;
    let projectedRiskLevel = baseTwin.intelligence.riskLevel;
    let projectedServiceCoverage = baseTwin.maintenance.serviceCoverageScore;
    let projectedMileage = baseTwin.odometer.currentMileage;
    let projectedBatterySoH: number | null = null;

    // 2. Execute Isolated Scenario Logic
    switch (scenarioType) {
      case 'SCHEDULED_MAINTENANCE': {
        const plannedMileage = Number(inputs.plannedMileage || projectedMileage + 5000);
        const plannedDate = inputs.plannedDate || new Date(Date.now() + 30 * 86400000).toISOString();
        const serviceType = inputs.serviceType || 'Major Scheduled Inspection';

        assumptions = [
          'Assumes scheduled service is performed by an ISO-certified authorized facility.',
          'Assumes all recommended parts, lubricants, and diagnostics pass verification.',
          'Assumes odometer progression between now and service date is linear.',
        ];

        // Service increases coverage
        const newServiceCount = baseTwin.maintenance.totalServicesCount + 1;
        const newExpectedServices = Math.max(1, Math.floor(plannedMileage / 15000));
        const newCoverage = Math.min(100, Math.round((newServiceCount / newExpectedServices) * 100));
        projectedServiceCoverage = newCoverage;
        projectedHealthScore = Math.min(100, baseTwin.intelligence.healthScore + 6);
        projectedMileage = Math.max(projectedMileage, plannedMileage);

        diffs = [
          {
            attribute: 'serviceCount',
            baseValue: baseTwin.maintenance.totalServicesCount,
            simulatedValue: newServiceCount,
            changeExplanation: `Proposed ${serviceType} increments total service ledger count.`,
            impactLevel: 'POSITIVE',
          },
          {
            attribute: 'serviceCoverageScore',
            baseValue: `${baseTwin.maintenance.serviceCoverageScore}%`,
            simulatedValue: `${newCoverage}%`,
            changeExplanation: 'Fulfilling upcoming service interval increases coverage score.',
            impactLevel: 'POSITIVE',
          },
          {
            attribute: 'healthScore',
            baseValue: baseTwin.intelligence.healthScore,
            simulatedValue: projectedHealthScore,
            changeExplanation: 'Resolving pending maintenance requirements restores health points.',
            impactLevel: 'POSITIVE',
          },
          {
            attribute: 'isOverdueForService',
            baseValue: baseTwin.maintenance.serviceGapsDetected,
            simulatedValue: false,
            changeExplanation: 'Timely maintenance clears overdue status flag.',
            impactLevel: 'POSITIVE',
          },
        ];

        explanation = `Performing ${serviceType} at ${plannedMileage.toLocaleString()} km would elevate the vehicle's service coverage to ${newCoverage}% and boost its health score from ${baseTwin.intelligence.healthScore} to ${projectedHealthScore}.`;
        break;
      }

      case 'ODOMETER_PROJECTION': {
        const hypotheticalMileage = Number(inputs.hypotheticalMileage ?? inputs.projectedOdometerKm);
        const hypotheticalDate = inputs.hypotheticalDate ? new Date(inputs.hypotheticalDate) : new Date();

        if (isNaN(hypotheticalMileage)) {
          throw new Error('hypotheticalMileage is required for ODOMETER_PROJECTION scenario');
        }

        assumptions = [
          'Evaluates monotonicity against the current latest recorded reading.',
          'Calculates average daily mileage velocity to determine feasibility.',
          'Flags non-monotonic odometer entries as simulated rollbacks.',
        ];

        const deltaKm = hypotheticalMileage - baseTwin.odometer.currentMileage;
        const isRollback = deltaKm < 0;

        if (isRollback) {
          projectedRiskLevel = 'HIGH';
          projectedHealthScore = Math.max(0, baseTwin.intelligence.healthScore - 30);
          warningFlags.push('SIMULATED_ODOMETER_ROLLBACK_DETECTED');
        } else {
          projectedMileage = hypotheticalMileage;
        }

        diffs = [
          {
            attribute: 'currentMileage',
            baseValue: `${baseTwin.odometer.currentMileage.toLocaleString()} km`,
            simulatedValue: `${hypotheticalMileage.toLocaleString()} km`,
            changeExplanation: `Proposed odometer delta of ${deltaKm > 0 ? '+' : ''}${deltaKm.toLocaleString()} km.`,
            impactLevel: isRollback ? 'CRITICAL' : 'NEUTRAL',
          },
          {
            attribute: 'isMonotonic',
            baseValue: baseTwin.odometer.isMonotonic,
            simulatedValue: !isRollback,
            changeExplanation: isRollback
              ? 'Reading violates odometer monotonicity constraint (decreasing value).'
              : 'Reading satisfies chronological monotonicity.',
            impactLevel: isRollback ? 'CRITICAL' : 'POSITIVE',
          },
          {
            attribute: 'healthScore',
            baseValue: baseTwin.intelligence.healthScore,
            simulatedValue: projectedHealthScore,
            changeExplanation: isRollback
              ? 'Simulated rollback triggers severe deduction (-30 pts).'
              : 'Valid odometer addition preserves baseline health score.',
            impactLevel: isRollback ? 'CRITICAL' : 'NEUTRAL',
          },
        ];

        explanation = isRollback
          ? `WARNING: A reading of ${hypotheticalMileage.toLocaleString()} km is ${Math.abs(deltaKm).toLocaleString()} km lower than the current verified reading (${baseTwin.odometer.currentMileage.toLocaleString()} km). This would trigger a critical rollback alert.`
          : `An odometer reading of ${hypotheticalMileage.toLocaleString()} km is chronologically valid and represents normal progression.`;
        break;
      }

      case 'OWNERSHIP_PRECHECK': {
        const proposedOwnerName = inputs.proposedOwnerName || 'Prospective Buyer LLC';
        const proposedRole = inputs.proposedOwnerRole || 'VEHICLE_OWNER';

        assumptions = [
          'Verifies that the vehicle has no active stolen, scrap, or critical collision stop-flags.',
          'Assumes the prospective buyer has completed KYC / cryptographic identity setup.',
          'Pre-checks ownership transfer prerequisites without updating ownership state.',
        ];

        const hasTamper = baseTwin.blockchain.integrityStatus === 'TAMPER_DETECTED';
        const canTransfer = !hasTamper && baseTwin.identity.status === 'ACTIVE';

        diffs = [
          {
            attribute: 'ownershipCount',
            baseValue: baseTwin.ownership.totalOwnersCount,
            simulatedValue: baseTwin.ownership.totalOwnersCount + 1,
            changeExplanation: 'Transfer would increment total recorded owners count.',
            impactLevel: 'NEUTRAL',
          },
          {
            attribute: 'currentOwnerName',
            baseValue: baseTwin.ownership.currentOwnerName,
            simulatedValue: proposedOwnerName,
            changeExplanation: 'Ownership assignment to prospective buyer.',
            impactLevel: 'NEUTRAL',
          },
          {
            attribute: 'transferPrerequisitesMet',
            baseValue: 'NOT_APPLICABLE',
            simulatedValue: canTransfer ? 'APPROVED' : 'BLOCKED',
            changeExplanation: canTransfer
              ? 'All vehicle records, blockchain anchors, and title checks satisfy transfer rules.'
              : 'Transfer blocked due to active integrity warnings.',
            impactLevel: canTransfer ? 'POSITIVE' : 'CRITICAL',
          },
        ];

        explanation = canTransfer
          ? `Pre-check APPROVED: Vehicle is in valid standing for ownership transfer to ${proposedOwnerName}. Title and blockchain records verified.`
          : `Pre-check BLOCKED: Vehicle cannot be transferred due to unresolved integrity or status warnings.`;
        break;
      }

      case 'BATTERY_DEGRADATION': {
        const projectedMonths = Number(inputs.projectedMonths || 24);
        const annualMileageKm = Number(inputs.annualMileageKm || 15000);
        const fastDcPercentage = Number(inputs.fastDcPercentage || 30);

        assumptions = [
          'Calculates capacity degradation using empirical NMC/LFP electrochemical aging coefficients.',
          'High DC fast charging (>50%) accelerates cyclic degradation by 1.25x.',
          'Evaluates against EU Battery Passport warranty standard (70% retention threshold at 8 years / 160,000 km).',
        ];

        const currentSoH = 94.0; // Baseline EV SoH
        const calendarDegradation = (projectedMonths / 12) * 1.2; // ~1.2% per year
        const cycleDegradation = ((annualMileageKm * (projectedMonths / 12)) / 100000) * 1.5;
        const fastChargingFactor = fastDcPercentage > 50 ? 1.25 : 1.0;
        const totalDegradation = (calendarDegradation + cycleDegradation) * fastChargingFactor;

        projectedBatterySoH = Math.max(50, Math.round((currentSoH - totalDegradation) * 10) / 10);
        const meetsEuWarranty = projectedBatterySoH >= 70.0;

        diffs = [
          {
            attribute: 'batteryStateOfHealth',
            baseValue: `${currentSoH}%`,
            simulatedValue: `${projectedBatterySoH}%`,
            changeExplanation: `Projected degradation of -${totalDegradation.toFixed(1)}% over ${projectedMonths} months.`,
            impactLevel: projectedBatterySoH < 70 ? 'CRITICAL' : projectedBatterySoH < 80 ? 'WARNING' : 'POSITIVE',
          },
          {
            attribute: 'euWarrantyCompliance',
            baseValue: 'COMPLIANT',
            simulatedValue: meetsEuWarranty ? 'COMPLIANT (HEALTHY)' : 'WARRANTY_BREACH_PROJECTED',
            changeExplanation: meetsEuWarranty
              ? 'Projected retention remains above the 70.0% EU Battery Passport minimum threshold.'
              : 'Battery retention drops below warranty threshold; replacement or reconditioning recommended.',
            impactLevel: meetsEuWarranty ? 'POSITIVE' : 'CRITICAL',
          },
        ];

        explanation = `Over a ${projectedMonths}-month horizon at ${annualMileageKm.toLocaleString()} km/year, projected battery State of Health reaches ${projectedBatterySoH}%. It ${meetsEuWarranty ? 'comfortably exceeds' : 'falls below'} the EU warranty minimum threshold.`;
        break;
      }

      default:
        throw new Error(`Unsupported scenarioType: ${scenarioType}`);
    }

    // 3. Persist Simulation Audit Record
    const run = await prisma.twinScenarioRun.create({
      data: {
        vehicleId,
        userId,
        scenarioType,
        status: 'COMPLETED',
        scenarioInputsJson: JSON.stringify(inputs),
        baseTwinVersion: baseVersion,
        simulatedDiffJson: JSON.stringify(diffs),
        explanation,
        isSimulated: true,
      },
    });

    return {
      scenarioId: run.id,
      vehicleId,
      scenarioType,
      status: 'COMPLETED',
      baseTwinVersion: baseVersion,
      simulatedAt: new Date().toISOString(),
      assumptions,
      inputs,
      diffs,
      simulatedStateSummary: {
        projectedHealthScore,
        projectedRiskLevel,
        projectedServiceCoverage,
        projectedMileage,
        projectedBatterySoH,
        warningFlags,
      },
      explanation,
      isSimulated: true,
    };
  }

  /**
   * Retrieves past scenario simulations for a vehicle.
   */
  public async getScenarioHistory(vehicleId: string): Promise<any[]> {
    return prisma.twinScenarioRun.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}

export const twinScenarioService = TwinScenarioService.getInstance();
