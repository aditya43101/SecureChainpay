import {
  Vehicle,
  ServiceRecord,
  OdometerRecord,
  AccidentRecord,
  InsuranceRecord,
  VehicleDocument,
  OwnershipHistory,
} from '@prisma/client';
import { DetectedAnomaly } from './types';
import { FullVehicleVerificationReport } from '../../blockchain/types';

export class AnomalyDetectionService {
  public static readonly VERSION = 'v1.0.0';

  /**
   * Run comprehensive anomaly detection across all vehicle lifecycle domains
   */
  public detectAnomalies(params: {
    vehicle: Vehicle & {
      serviceRecords: ServiceRecord[];
      odometerRecords: OdometerRecord[];
      accidentRecords: AccidentRecord[];
      insuranceRecords: InsuranceRecord[];
      documents: VehicleDocument[];
      ownershipHistory: OwnershipHistory[];
    };
    fullVerificationReport: FullVehicleVerificationReport;
  }): DetectedAnomaly[] {
    const anomalies: DetectedAnomaly[] = [];
    const { vehicle, fullVerificationReport } = params;
    const now = new Date();

    // ========================================================================
    // 1. ODOMETER ANOMALIES & ROLLBACK DETECTION
    // ========================================================================
    const sortedOdometer = [...vehicle.odometerRecords].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );

    for (let i = 1; i < sortedOdometer.length; i++) {
      const prev = sortedOdometer[i - 1];
      const curr = sortedOdometer[i];

      // A. Odometer Rollback Detection
      if (curr.mileage < prev.mileage) {
        const diff = prev.mileage - curr.mileage;
        anomalies.push({
          id: `ANOM-ODO-ROLLBACK-${curr.id}`,
          category: 'ODOMETER',
          severity: 'HIGH',
          title: 'Odometer Rollback / Mileage Decrease Detected',
          explanation: `A later odometer record indicates ${curr.mileage.toLocaleString()} km, which is ${diff.toLocaleString()} km lower than the previous verified reading of ${prev.mileage.toLocaleString()} km.`,
          affectedRecordId: curr.id,
          affectedRecordType: 'OdometerRecord',
          detectionTimestamp: now.toISOString(),
          evidence: {
            expected: `>= ${prev.mileage.toLocaleString()} km`,
            actual: `${curr.mileage.toLocaleString()} km`,
            sourceRecords: [
              {
                id: prev.id,
                type: 'OdometerRecord',
                date: prev.recordedAt.toISOString(),
                value: prev.mileage,
                hash: prev.recordHash,
              },
              {
                id: curr.id,
                type: 'OdometerRecord',
                date: curr.recordedAt.toISOString(),
                value: curr.mileage,
                hash: curr.recordHash,
              },
            ],
            notes: curr.notes || 'Recorded anomaly',
          },
          recommendation: 'Verify physical cluster diagnostic logs and certified garage work orders for potential odometer manipulation.',
        });
      }

      // B. Impossible Mileage Jump Detection (> 1,200 km per day on average)
      const dayDiff = Math.max(
        1 / 24,
        (new Date(curr.recordedAt).getTime() - new Date(prev.recordedAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      const kmDiff = curr.mileage - prev.mileage;
      const kmPerDay = kmDiff / dayDiff;

      if (kmPerDay > 1500 && kmDiff > 3000) {
        anomalies.push({
          id: `ANOM-ODO-SPIKE-${curr.id}`,
          category: 'ODOMETER',
          severity: 'MEDIUM',
          title: 'Unusually High Mileage Accumulation Velocity',
          explanation: `Mileage increased by ${kmDiff.toLocaleString()} km across ${dayDiff.toFixed(1)} days (${Math.round(kmPerDay).toLocaleString()} km/day), which exceeds normal vehicle usage benchmarks.`,
          affectedRecordId: curr.id,
          affectedRecordType: 'OdometerRecord',
          detectionTimestamp: now.toISOString(),
          evidence: {
            expected: `<= 800 km/day average`,
            actual: `${Math.round(kmPerDay).toLocaleString()} km/day`,
            sourceRecords: [
              { id: prev.id, type: 'OdometerRecord', date: prev.recordedAt.toISOString(), value: prev.mileage },
              { id: curr.id, type: 'OdometerRecord', date: curr.recordedAt.toISOString(), value: curr.mileage },
            ],
          },
          recommendation: 'Check for potential unit entry mistake (e.g. miles vs km) or commercial continuous fleet driving.',
        });
      }
    }

    // Flag known database rollback flag
    for (const rec of vehicle.odometerRecords) {
      if (rec.rollbackDetected && !anomalies.some((a) => a.affectedRecordId === rec.id)) {
        anomalies.push({
          id: `ANOM-ODO-FLAGGED-${rec.id}`,
          category: 'ODOMETER',
          severity: 'HIGH',
          title: 'Flagged Odometer Discrepancy',
          explanation: `System verification flagged this odometer record as an inconsistent reading relative to the vehicle timeline.`,
          affectedRecordId: rec.id,
          affectedRecordType: 'OdometerRecord',
          detectionTimestamp: now.toISOString(),
          evidence: {
            expected: 'Monotonically increasing chronological mileage',
            actual: `${rec.mileage.toLocaleString()} km`,
            sourceRecords: [{ id: rec.id, type: 'OdometerRecord', date: rec.recordedAt.toISOString(), value: rec.mileage }],
          },
        });
      }
    }

    // ========================================================================
    // 2. SERVICE & MAINTENANCE ANOMALIES
    // ========================================================================
    const sortedServices = [...vehicle.serviceRecords].sort(
      (a, b) => new Date(a.serviceDate).getTime() - new Date(b.serviceDate).getTime()
    );

    for (let i = 0; i < sortedServices.length; i++) {
      const s = sortedServices[i];

      // A. Future-Dated Service
      if (new Date(s.serviceDate).getTime() > now.getTime() + 86400000) {
        anomalies.push({
          id: `ANOM-SRV-FUTURE-${s.id}`,
          category: 'SERVICE',
          severity: 'HIGH',
          title: 'Future-Dated Service Record',
          explanation: `Service record is timestamped in the future (${s.serviceDate.toISOString().split('T')[0]}).`,
          affectedRecordId: s.id,
          affectedRecordType: 'ServiceRecord',
          detectionTimestamp: now.toISOString(),
          evidence: {
            expected: `<= ${now.toISOString().split('T')[0]}`,
            actual: s.serviceDate.toISOString().split('T')[0],
            sourceRecords: [{ id: s.id, type: 'ServiceRecord', date: s.serviceDate.toISOString(), value: s.serviceType }],
          },
          recommendation: 'Verify calendar timestamp clock synchronization on service invoice intake.',
        });
      }

      // B. Service Prior to Vehicle Manufacturing Year
      const serviceYear = new Date(s.serviceDate).getFullYear();
      if (serviceYear < vehicle.manufacturingYear) {
        anomalies.push({
          id: `ANOM-SRV-PREMFR-${s.id}`,
          category: 'SERVICE',
          severity: 'HIGH',
          title: 'Service Prior to Manufacturing Date',
          explanation: `Service date (${serviceYear}) precedes the vehicle model manufacturing year (${vehicle.manufacturingYear}).`,
          affectedRecordId: s.id,
          affectedRecordType: 'ServiceRecord',
          detectionTimestamp: now.toISOString(),
          evidence: {
            expected: `>= Year ${vehicle.manufacturingYear}`,
            actual: `Year ${serviceYear}`,
            sourceRecords: [{ id: s.id, type: 'ServiceRecord', date: s.serviceDate.toISOString() }],
          },
        });
      }

      // C. Duplicate Service Record Detection (same date, same garage, same mileage)
      for (let j = i + 1; j < sortedServices.length; j++) {
        const other = sortedServices[j];
        const isSameDate = s.serviceDate.toISOString().split('T')[0] === other.serviceDate.toISOString().split('T')[0];
        const isSameMileage = s.mileage === other.mileage;
        const isSameGarage = s.garageId === other.garageId;

        if (isSameDate && (isSameMileage || isSameGarage)) {
          anomalies.push({
            id: `ANOM-SRV-DUP-${s.id}-${other.id}`,
            category: 'SERVICE',
            severity: 'MEDIUM',
            title: 'Potential Duplicate Service Entry',
            explanation: `Multiple service entries recorded on the same date (${s.serviceDate.toISOString().split('T')[0]}) with identical mileage (${s.mileage.toLocaleString()} km).`,
            affectedRecordId: other.id,
            affectedRecordType: 'ServiceRecord',
            detectionTimestamp: now.toISOString(),
            evidence: {
              expected: 'Unique work orders per maintenance visit',
              actual: 'Duplicate entries on matching date',
              sourceRecords: [
                { id: s.id, type: 'ServiceRecord', date: s.serviceDate.toISOString(), value: s.serviceType },
                { id: other.id, type: 'ServiceRecord', date: other.serviceDate.toISOString(), value: other.serviceType },
              ],
            },
          });
        }
      }
    }

    // ========================================================================
    // 3. ACCIDENT & REPAIR CHRONOLOGY ANOMALIES
    // ========================================================================
    for (const acc of vehicle.accidentRecords) {
      // A. Repair Date Precedes Accident Date
      if (acc.repairedAt && new Date(acc.repairedAt).getTime() < new Date(acc.accidentDate).getTime()) {
        anomalies.push({
          id: `ANOM-ACC-TIMEINVERT-${acc.id}`,
          category: 'ACCIDENT',
          severity: 'HIGH',
          title: 'Accident Repair Timestamp Inversion',
          explanation: `Repair completion date (${acc.repairedAt.toISOString().split('T')[0]}) is recorded before the accident incident date (${acc.accidentDate.toISOString().split('T')[0]}).`,
          affectedRecordId: acc.id,
          affectedRecordType: 'AccidentRecord',
          detectionTimestamp: now.toISOString(),
          evidence: {
            expected: `Repair Date >= ${acc.accidentDate.toISOString().split('T')[0]}`,
            actual: `Repair Date: ${acc.repairedAt.toISOString().split('T')[0]}`,
            sourceRecords: [{ id: acc.id, type: 'AccidentRecord', date: acc.accidentDate.toISOString() }],
          },
        });
      }

      // B. Unresolved Severe Accident
      if (acc.severity === 'SEVERE' && acc.repairStatus === 'PENDING') {
        const daysPending = Math.round((now.getTime() - new Date(acc.accidentDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysPending > 45) {
          anomalies.push({
            id: `ANOM-ACC-UNRESOLVED-${acc.id}`,
            category: 'ACCIDENT',
            severity: 'HIGH',
            title: 'Unresolved Severe Structural Damage',
            explanation: `Severe accident reported ${daysPending} days ago remains in PENDING repair status without certified garage sign-off.`,
            affectedRecordId: acc.id,
            affectedRecordType: 'AccidentRecord',
            detectionTimestamp: now.toISOString(),
            evidence: {
              expected: 'Certified OEM body shop repair completion',
              actual: 'Repair Status: PENDING',
              sourceRecords: [{ id: acc.id, type: 'AccidentRecord', date: acc.accidentDate.toISOString(), value: 'SEVERE' }],
            },
            recommendation: 'Perform physical chassis alignment and ultrasonic structural inspection prior to transfer.',
          });
        }
      }
    }

    // ========================================================================
    // 4. INSURANCE INTEGRITY ANOMALIES
    // ========================================================================
    const activePolicies = vehicle.insuranceRecords.filter((ins) => ins.status === 'ACTIVE');
    if (activePolicies.length > 1) {
      anomalies.push({
        id: `ANOM-INS-OVERLAP-${vehicle.id}`,
        category: 'INSURANCE',
        severity: 'LOW',
        title: 'Multiple Concurrent Active Insurance Policies',
        explanation: `Vehicle currently lists ${activePolicies.length} overlapping policies in ACTIVE status.`,
        affectedRecordId: activePolicies[0].id,
        affectedRecordType: 'InsuranceRecord',
        detectionTimestamp: now.toISOString(),
        evidence: {
          expected: 'Single primary active policy per vehicle',
          actual: `${activePolicies.length} active policies`,
          sourceRecords: activePolicies.map((p) => ({
            id: p.id,
            type: 'InsuranceRecord',
            value: p.policyReference,
            date: p.startDate.toISOString(),
          })),
        },
      });
    }

    // Check for expired insurance without subsequent active policy
    const sortedInsurance = [...vehicle.insuranceRecords].sort(
      (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
    );
    if (sortedInsurance.length > 0 && activePolicies.length === 0) {
      const latestPolicy = sortedInsurance[0];
      if (new Date(latestPolicy.endDate).getTime() < now.getTime()) {
        const daysExpired = Math.round((now.getTime() - new Date(latestPolicy.endDate).getTime()) / (1000 * 60 * 60 * 24));
        anomalies.push({
          id: `ANOM-INS-EXPIRED-${latestPolicy.id}`,
          category: 'INSURANCE',
          severity: 'MEDIUM',
          title: 'Insurance Coverage Lapsed',
          explanation: `Vehicle insurance policy ${latestPolicy.policyReference} expired ${daysExpired} days ago without an active renewal recorded.`,
          affectedRecordId: latestPolicy.id,
          affectedRecordType: 'InsuranceRecord',
          detectionTimestamp: now.toISOString(),
          evidence: {
            expected: 'Active third-party and comprehensive insurance policy',
            actual: `Expired on ${latestPolicy.endDate.toISOString().split('T')[0]}`,
            sourceRecords: [{ id: latestPolicy.id, type: 'InsuranceRecord', date: latestPolicy.endDate.toISOString() }],
          },
          recommendation: 'Renew motor vehicle insurance coverage to maintain public compliance.',
        });
      }
    }

    // ========================================================================
    // 5. DOCUMENT INTELLIGENCE & OCR ANOMALIES
    // ========================================================================
    for (const doc of vehicle.documents) {
      if (doc.consistencyStatus === 'INCONSISTENT') {
        let detailsParsed: any = null;
        try {
          if (doc.consistencyDetails) detailsParsed = JSON.parse(doc.consistencyDetails);
        } catch {
          // Ignore json parse error
        }

        anomalies.push({
          id: `ANOM-DOC-MISMATCH-${doc.id}`,
          category: 'DOCUMENT',
          severity: 'HIGH',
          title: `Document vs Database Discrepancy (${doc.documentType})`,
          explanation: `OCR text extraction identified conflicting specifications between document "${doc.title}" and verified database records.`,
          affectedRecordId: doc.id,
          affectedRecordType: 'VehicleDocument',
          detectionTimestamp: now.toISOString(),
          evidence: {
            expected: 'Document fields must match vehicle database ledger with 100% fidelity',
            actual: detailsParsed?.summary || 'Field mismatch detected during OCR consistency check',
            sourceRecords: [{ id: doc.id, type: 'VehicleDocument', value: doc.title, hash: doc.fileHash }],
            notes: doc.extractedData ? 'OCR extracted fields available in document audit details' : undefined,
          },
          recommendation: 'Re-upload high-resolution certified original document or request issuer verification.',
        });
      }
    }

    // ========================================================================
    // 6. BLOCKCHAIN INTEGRITY & CRYPTOGRAPHIC TAMPER ANOMALIES
    // ========================================================================
    if (fullVerificationReport.hasTamper) {
      anomalies.push({
        id: `ANOM-BLK-TAMPER-${vehicle.id}`,
        category: 'BLOCKCHAIN',
        severity: 'CRITICAL',
        title: 'Cryptographic Blockchain Proof Mismatch (Tamper Detected)',
        explanation: 'Database record values differ from immutable cryptographic hashes anchored on the blockchain. Data integrity is compromised.',
        affectedRecordId: vehicle.id,
        affectedRecordType: 'Vehicle',
        detectionTimestamp: now.toISOString(),
        evidence: {
          expected: 'Database recalculated hash must match immutable on-chain record hash',
          actual: 'Cryptographic hash mismatch detected by Blockchain Verification Engine',
          sourceRecords: [
            {
              id: vehicle.id,
              type: 'Vehicle',
              hash: fullVerificationReport.vehicleIdentity.onChainHash || 'On-chain hash',
            },
          ],
          blockchainStatus: 'TAMPER_DETECTED',
        },
        recommendation: 'Perform 1-Click Cryptographic Remediation or audit recent administrative modifications.',
      });
    }

    return anomalies;
  }
}
