import {
  Vehicle,
  ServiceRecord,
  OdometerRecord,
  FuelType,
} from '@prisma/client';
import {
  PredictiveMaintenanceAssessment,
  MaintenancePredictionItem,
  RiskLevel,
} from './types';

interface MaintenanceTemplate {
  id: string;
  system: string;
  title: string;
  recommendedIntervalKm: number;
  recommendedIntervalMonths: number;
  fuelTypes: FuelType[];
  keywords: string[];
  recommendedServiceType: string;
  baseConfidence: 'HIGH' | 'MEDIUM';
}

export class MaintenancePredictionService {
  public static readonly VERSION = 'v1.0.0';

  /**
   * Deterministic OEM-aligned maintenance schedules by powertrain
   */
  private static readonly TEMPLATES: MaintenanceTemplate[] = [
    // EV Specific
    {
      id: 'EV_BATTERY_COOLANT',
      system: 'High-Voltage Battery & Thermal Management',
      title: 'EV Battery Coolant & High-Voltage Diagnostics',
      recommendedIntervalKm: 30000,
      recommendedIntervalMonths: 24,
      fuelTypes: [FuelType.ELECTRIC, FuelType.HYBRID],
      keywords: ['battery', 'coolant', 'thermal', 'high-voltage', 'pack', 'ecu'],
      recommendedServiceType: 'Battery Diagnostic & Coolant Service',
      baseConfidence: 'HIGH',
    },
    {
      id: 'EV_DRIVE_UNIT_FLUID',
      system: 'Electric Powertrain Drive Unit',
      title: 'Reduction Gearbox Fluid Inspection',
      recommendedIntervalKm: 60000,
      recommendedIntervalMonths: 36,
      fuelTypes: [FuelType.ELECTRIC],
      keywords: ['reduction gear', 'drive unit', 'gearbox', 'transmission fluid'],
      recommendedServiceType: 'Drive Unit Lubricant Service',
      baseConfidence: 'MEDIUM',
    },

    // Combustion (ICE / Hybrid) Specific
    {
      id: 'ICE_ENGINE_OIL',
      system: 'Internal Combustion Engine',
      title: 'Synthetic Engine Oil & Filter Replacement',
      recommendedIntervalKm: 10000,
      recommendedIntervalMonths: 12,
      fuelTypes: [FuelType.PETROL, FuelType.DIESEL, FuelType.HYBRID, FuelType.CNG, FuelType.LPG],
      keywords: ['engine oil', 'oil filter', 'synthetic', 'lube'],
      recommendedServiceType: 'Engine Lubrication Service',
      baseConfidence: 'HIGH',
    },
    {
      id: 'ICE_SPARK_PLUGS',
      system: 'Ignition & Fuel System',
      title: 'Spark Plugs & Ignition Coil Inspection',
      recommendedIntervalKm: 40000,
      recommendedIntervalMonths: 36,
      fuelTypes: [FuelType.PETROL, FuelType.HYBRID, FuelType.CNG, FuelType.LPG],
      keywords: ['spark plug', 'ignition', 'coil'],
      recommendedServiceType: 'Ignition System Service',
      baseConfidence: 'MEDIUM',
    },
    {
      id: 'ICE_AIR_FUEL_FILTER',
      system: 'Air Intake & Fuel Delivery',
      title: 'Engine Air Filter & Fuel Filter Replacement',
      recommendedIntervalKm: 20000,
      recommendedIntervalMonths: 24,
      fuelTypes: [FuelType.PETROL, FuelType.DIESEL, FuelType.CNG, FuelType.LPG],
      keywords: ['air filter', 'fuel filter', 'intake'],
      recommendedServiceType: 'Intake & Filtration Service',
      baseConfidence: 'MEDIUM',
    },

    // Universal Systems
    {
      id: 'BRAKE_SYSTEM_FLUID',
      system: 'Hydraulic Braking System',
      title: 'Brake Fluid Moisture Inspection & Pad Wear Check',
      recommendedIntervalKm: 20000,
      recommendedIntervalMonths: 24,
      fuelTypes: [FuelType.ELECTRIC, FuelType.PETROL, FuelType.DIESEL, FuelType.HYBRID, FuelType.CNG, FuelType.LPG],
      keywords: ['brake', 'pad', 'rotor', 'fluid', 'caliper'],
      recommendedServiceType: 'Brake Inspection & Fluid Service',
      baseConfidence: 'HIGH',
    },
    {
      id: 'CABIN_CLIMATE_FILTER',
      system: 'Climate Control & HVAC',
      title: 'Cabin HEPA Filter & Air Conditioning Sanitize',
      recommendedIntervalKm: 15000,
      recommendedIntervalMonths: 12,
      fuelTypes: [FuelType.ELECTRIC, FuelType.PETROL, FuelType.DIESEL, FuelType.HYBRID, FuelType.CNG, FuelType.LPG],
      keywords: ['cabin', 'hepa', 'ac', 'climate', 'filter', 'microfilter'],
      recommendedServiceType: 'HVAC Cabin Filter Service',
      baseConfidence: 'HIGH',
    },
    {
      id: 'TIRE_ROTATION_ALIGNMENT',
      system: 'Wheels, Tires & Chassis',
      title: 'Tire Rotation, Tread Depth & Laser Wheel Alignment',
      recommendedIntervalKm: 10000,
      recommendedIntervalMonths: 12,
      fuelTypes: [FuelType.ELECTRIC, FuelType.PETROL, FuelType.DIESEL, FuelType.HYBRID, FuelType.CNG, FuelType.LPG],
      keywords: ['tire', 'tyre', 'alignment', 'wheel', 'balancing', 'rotation'],
      recommendedServiceType: 'Tire & Alignment Service',
      baseConfidence: 'HIGH',
    },
    {
      id: 'AUXILIARY_12V_BATTERY',
      system: 'Electrical Architecture',
      title: '12V Auxiliary Starter/System Battery Diagnostic',
      recommendedIntervalKm: 35000,
      recommendedIntervalMonths: 24,
      fuelTypes: [FuelType.ELECTRIC, FuelType.PETROL, FuelType.DIESEL, FuelType.HYBRID, FuelType.CNG, FuelType.LPG],
      keywords: ['12v', 'auxiliary battery', 'starter battery', 'cranking'],
      recommendedServiceType: 'Electrical System Health Diagnostic',
      baseConfidence: 'MEDIUM',
    },
  ];

  public predictMaintenance(params: {
    vehicle: Vehicle;
    serviceRecords: ServiceRecord[];
    odometerRecords: OdometerRecord[];
  }): PredictiveMaintenanceAssessment {
    const { vehicle, serviceRecords, odometerRecords } = params;

    // Determine current verified mileage
    const allMileages = [
      ...odometerRecords.map((o) => o.mileage),
      ...serviceRecords.map((s) => s.mileage),
    ];
    const currentMileage = allMileages.length > 0 ? Math.max(...allMileages) : 1000;

    // Find latest service
    const sortedServices = [...serviceRecords].sort(
      (a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()
    );
    const lastService = sortedServices[0];

    const predictions: MaintenancePredictionItem[] = [];
    const applicableTemplates = MaintenancePredictionService.TEMPLATES.filter((t) =>
      t.fuelTypes.includes(vehicle.fuelType)
    );

    for (const t of applicableTemplates) {
      // Find historical matching service records
      const matchingServices = serviceRecords.filter((s) => {
        const textToSearch = `${s.serviceType} ${s.description} ${s.partsReplaced || ''}`.toLowerCase();
        return t.keywords.some((kw) => textToSearch.includes(kw));
      });

      const sortedMatching = matchingServices.sort(
        (a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()
      );
      const lastRelated = sortedMatching[0];

      let lastMileage = lastRelated ? lastRelated.mileage : 0;
      let lastDate = lastRelated ? lastRelated.serviceDate : new Date(vehicle.manufacturingYear, 0, 1);

      const kmSinceLast = currentMileage - lastMileage;
      const monthsSinceLast = (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24 * 30.4);

      const estimatedDueMileage = lastMileage + t.recommendedIntervalKm;
      const mileageRemaining = Math.max(0, estimatedDueMileage - currentMileage);

      // Determine urgency
      let urgency: 'IMMEDIATE' | 'SOON' | 'ROUTINE' = 'ROUTINE';
      if (kmSinceLast >= t.recommendedIntervalKm || monthsSinceLast >= t.recommendedIntervalMonths) {
        urgency = 'IMMEDIATE';
      } else if (
        kmSinceLast >= t.recommendedIntervalKm * 0.8 ||
        monthsSinceLast >= t.recommendedIntervalMonths * 0.8
      ) {
        urgency = 'SOON';
      }

      // Determine confidence
      let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = t.baseConfidence;
      if (serviceRecords.length >= 3) {
        confidence = 'HIGH';
      } else if (serviceRecords.length === 0) {
        confidence = 'LOW';
      }

      // Formulate clear, non-defective explanation
      let reason = `Recommended maintenance based on ${kmSinceLast.toLocaleString()} km and ${Math.round(monthsSinceLast)} months elapsed since last recorded service.`;
      if (!lastRelated) {
        reason = `No prior record of ${t.title.toLowerCase()} found in verified history. Estimated due based on current odometer of ${currentMileage.toLocaleString()} km.`;
      } else if (urgency === 'IMMEDIATE') {
        reason = `Mileage has reached or exceeded the recommended ${t.recommendedIntervalKm.toLocaleString()} km service threshold (${kmSinceLast.toLocaleString()} km accumulated).`;
      }

      predictions.push({
        id: `PRED-${t.id}-${vehicle.id}`,
        system: t.system,
        title: t.title,
        status: urgency === 'IMMEDIATE' ? 'PREDICTED' : 'ESTIMATED',
        confidence,
        urgency,
        estimatedDueMileage,
        mileageRemaining,
        reason,
        supportingHistory: {
          lastRelatedServiceDate: lastRelated?.serviceDate.toISOString(),
          lastRelatedServiceMileage: lastRelated?.mileage,
          recommendedIntervalKm: t.recommendedIntervalKm,
          recommendedIntervalMonths: t.recommendedIntervalMonths,
          currentMileage,
        },
        recommendedServiceType: t.recommendedServiceType,
        fuelTypeSuitability: t.fuelTypes,
      });
    }

    // Sort predictions: IMMEDIATE first, then SOON, then ROUTINE
    const urgencyOrder = { IMMEDIATE: 0, SOON: 1, ROUTINE: 2 };
    predictions.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    // Overall maintenance risk
    const immediateCount = predictions.filter((p) => p.urgency === 'IMMEDIATE').length;
    const overallMaintenanceRisk: RiskLevel =
      immediateCount >= 3 ? 'HIGH' : immediateCount >= 1 ? 'MEDIUM' : 'LOW';

    let summary = `Upcoming maintenance schedule generated based on ${currentMileage.toLocaleString()} km odometer reading and verified service history.`;
    if (immediateCount > 0) {
      summary = `${immediateCount} maintenance item(s) predicted as currently due based on manufacturer interval thresholds.`;
    }

    return {
      currentMileage,
      lastRecordedServiceDate: lastService?.serviceDate.toISOString(),
      lastRecordedServiceMileage: lastService?.mileage,
      overallMaintenanceRisk,
      summary,
      predictions,
      engineVersion: MaintenancePredictionService.VERSION,
    };
  }
}
