import { prisma } from '../../lib/prisma';
import { BlockchainService } from '../../blockchain/services/blockchainService';
import { BatchOrchestrationService } from '../../blockchain/services/batchOrchestrationService';

export interface RuleEvaluationSummary {
  findingsCreated: number;
  findingsUpdated: number;
  totalFindingsActive: number;
  rulesEvaluated: number;
  durationMs: number;
  timestamp: string;
}

export interface CandidateFindingInput {
  ruleId: string;
  ruleVersion?: string;
  ruleName: string;
  category: string;
  severity: 'INFORMATIONAL' | 'LOW' | 'MEDIUM' | 'HIGH';
  status?: 'NEW' | 'UNDER_REVIEW' | 'NEEDS_MORE_EVIDENCE' | 'RESOLVED' | 'DISMISSED';
  primaryEntityId: string;
  primaryEntityType: string;
  title: string;
  description: string;
  explanation: string;
  unknowns?: string;
  recommendedAction?: string;
  involvedNodeKeys?: string[];
  evidenceReferences: Array<{
    recordType: string;
    recordId: string;
    field?: string;
    expected?: any;
    actual?: any;
    hash?: string;
    notes?: string;
  }>;
}

export class FraudRulesEngine {
  private static instance: FraudRulesEngine;
  private bcService = BlockchainService.getInstance();
  private batchService = BatchOrchestrationService.getInstance();

  public static getInstance(): FraudRulesEngine {
    if (!FraudRulesEngine.instance) {
      FraudRulesEngine.instance = new FraudRulesEngine();
    }
    return FraudRulesEngine.instance;
  }

  /**
   * Evaluates all deterministic rules across the entire platform
   */
  public async evaluateAllRules(): Promise<RuleEvaluationSummary> {
    const startTime = performance.now();
    let findingsCreated = 0;
    let findingsUpdated = 0;

    const candidateFindings: CandidateFindingInput[] = [];

    // Helper: generate unique finding key for idempotency
    const makeFindingKey = (ruleId: string, primaryEntityId: string, discriminator = '') =>
      `${ruleId}:${primaryEntityId}:${discriminator}`;

    // Map existing finding keys in DB to avoid unnecessary duplicates
    const existingFindings = await prisma.fraudFinding.findMany({
      select: { id: true, findingNumber: true, ruleId: true, primaryEntityId: true, status: true },
    });
    const existingKeyMap = new Map<string, string>();
    for (const f of existingFindings) {
      existingKeyMap.set(`${f.ruleId}:${f.primaryEntityId}`, f.id);
    }

    // ------------------------------------------------------------------------
    // RULE A: ODOMETER ROLLBACK & REVERSAL DETECTION
    // ------------------------------------------------------------------------
    const vehiclesWithOdometers = await prisma.vehicle.findMany({
      include: {
        odometerRecords: { orderBy: { recordedAt: 'asc' } },
        serviceRecords: { orderBy: { serviceDate: 'asc' } },
      },
    });

    for (const v of vehiclesWithOdometers) {
      // Merge all chronological mileage checkpoints from both odometer & service records
      const timeline: Array<{
        date: Date;
        mileage: number;
        source: string;
        recordId: string;
        notes?: string | null;
      }> = [];

      for (const o of v.odometerRecords) {
        timeline.push({
          date: o.recordedAt,
          mileage: o.mileage,
          source: `Odometer (${o.sourceType})`,
          recordId: o.id,
          notes: o.notes,
        });
      }

      for (const s of v.serviceRecords) {
        timeline.push({
          date: s.serviceDate,
          mileage: s.mileage,
          source: `Service (${s.serviceType})`,
          recordId: s.id,
          notes: s.notes,
        });
      }

      // Sort chronologically
      timeline.sort((a, b) => a.date.getTime() - b.date.getTime());

      for (let i = 1; i < timeline.length; i++) {
        const prev = timeline[i - 1];
        const curr = timeline[i];

        if (curr.mileage < prev.mileage) {
          const dropKm = prev.mileage - curr.mileage;

          // Check if this rollback has an explicit authorized correction note
          const isDocumentedCorrection =
            (curr.notes && curr.notes.toLowerCase().includes('correction')) ||
            (prev.notes && prev.notes.toLowerCase().includes('correction')) ||
            (curr.notes && curr.notes.toLowerCase().includes('replacement'));

          if (isDocumentedCorrection) {
            candidateFindings.push({
              ruleId: 'RULE_ODOMETER_CORRECTION_DOCUMENTED',
              ruleName: 'Documented Odometer Adjustment / Correction',
              category: 'ODOMETER_INTEGRITY',
              severity: 'INFORMATIONAL',
              primaryEntityId: v.id,
              primaryEntityType: 'VEHICLE',
              title: `Documented Odometer Correction on ${v.passportId}`,
              description: `Mileage decreased from ${prev.mileage.toLocaleString()} km to ${curr.mileage.toLocaleString()} km, but was accompanied by an explicit correction/replacement note.`,
              explanation: `Timeline analysis identified a drop of ${dropKm} km between ${prev.date.toISOString().slice(0, 10)} (${prev.source}) and ${curr.date.toISOString().slice(0, 10)} (${curr.source}). Because notes document an authorized correction, this is recorded as an informational review event rather than an anomaly.`,
              unknowns: 'Physical gauge calibration certification was not independently verified.',
              recommendedAction: 'Verify supporting workshop repair invoice confirms gauge replacement.',
              involvedNodeKeys: [`VEHICLE:${v.id}`, `ODOMETER_RECORD:${curr.recordId}`],
              evidenceReferences: [
                {
                  recordType: 'ODOMETER_RECORD',
                  recordId: prev.recordId,
                  field: 'mileage',
                  expected: `${prev.mileage} km`,
                  actual: `${prev.mileage} km`,
                  notes: prev.notes || undefined,
                },
                {
                  recordType: 'ODOMETER_RECORD',
                  recordId: curr.recordId,
                  field: 'mileage',
                  expected: `>= ${prev.mileage} km`,
                  actual: `${curr.mileage} km`,
                  notes: curr.notes || undefined,
                },
              ],
            });
          } else {
            // Unexplained Rollback
            candidateFindings.push({
              ruleId: 'RULE_ODOMETER_ROLLBACK',
              ruleName: 'Unexplained Odometer Rollback Detected',
              category: 'ODOMETER_INTEGRITY',
              severity: dropKm > 5000 ? 'HIGH' : 'MEDIUM',
              primaryEntityId: v.id,
              primaryEntityType: 'VEHICLE',
              title: `Critical Odometer Rollback on ${v.passportId} (-${dropKm.toLocaleString()} km)`,
              description: `Odometer reading decreased from ${prev.mileage.toLocaleString()} km on ${prev.date.toISOString().slice(0, 10)} to ${curr.mileage.toLocaleString()} km on ${curr.date.toISOString().slice(0, 10)}.`,
              explanation: `Chronological analysis detected a negative mileage delta of ${dropKm.toLocaleString()} km without any authorized gauge replacement or correction record in the database.`,
              unknowns: 'Whether this discrepancy is due to typographical clerical error or intentional cluster manipulation.',
              recommendedAction: 'Contact the certifying garage or technician Roy to inspect the physical vehicle cluster and service invoice.',
              involvedNodeKeys: [`VEHICLE:${v.id}`, `ODOMETER_RECORD:${curr.recordId}`],
              evidenceReferences: [
                {
                  recordType: 'ODOMETER_RECORD',
                  recordId: prev.recordId,
                  field: 'mileage',
                  expected: 'Non-decreasing baseline',
                  actual: `${prev.mileage} km`,
                },
                {
                  recordType: 'ODOMETER_RECORD',
                  recordId: curr.recordId,
                  field: 'mileage',
                  expected: `>= ${prev.mileage} km`,
                  actual: `${curr.mileage} km`,
                },
              ],
            });
          }
        }
      }
    }

    // ------------------------------------------------------------------------
    // RULE B: CONFLICTING VEHICLE IDENTITY
    // ------------------------------------------------------------------------
    const vehiclesWithCerts = await prisma.vehicle.findMany({
      include: {
        manufacturerCertificate: true,
        documents: true,
      },
    });

    for (const v of vehiclesWithCerts) {
      if (v.manufacturerCertificate) {
        const cert = v.manufacturerCertificate;
        let certVin: string | null = null;
        try {
          const spec = JSON.parse(cert.specificationSnapshot || '{}');
          if (spec.vin) certVin = String(spec.vin);
        } catch {}

        if (certVin && certVin.trim().toUpperCase() !== v.vin.trim().toUpperCase()) {
          candidateFindings.push({
            ruleId: 'RULE_IDENTITY_CONFLICT_VIN',
            ruleName: 'Vehicle VIN Mismatch with Manufacturer Birth Certificate',
            category: 'IDENTITY_CONFLICT',
            severity: 'HIGH',
            primaryEntityId: v.id,
            primaryEntityType: 'VEHICLE',
            title: `VIN Discrepancy on ${v.passportId}`,
            description: `Vehicle registered VIN (${v.vin}) does not match factory issued birth certificate VIN (${certVin}).`,
            explanation: `Factory birth certificate ${cert.certificateNumber} committed to the vehicle references VIN ${certVin}, which conflicts with the vehicle registration VIN ${v.vin}.`,
            unknowns: 'Whether vehicle was re-registered or birth certificate was mislinked during issuance.',
            recommendedAction: 'Verify physical chassis stamp and factory plant manifest.',
            involvedNodeKeys: [`VEHICLE:${v.id}`],
            evidenceReferences: [
              {
                recordType: 'Vehicle',
                recordId: v.id,
                field: 'vin',
                expected: certVin,
                actual: v.vin,
              },
              {
                recordType: 'ManufacturerCertificate',
                recordId: cert.id,
                field: 'specificationSnapshot.vin',
                expected: v.vin,
                actual: certVin,
              },
            ],
          });
        }
      }

      // Check Document OCR VIN against vehicle registered VIN
      for (const d of v.documents) {
        if (d.extractedData) {
          try {
            const ext = JSON.parse(d.extractedData);
            if (ext.vin && ext.vin.trim().toUpperCase() !== v.vin.trim().toUpperCase()) {
              candidateFindings.push({
                ruleId: 'RULE_IDENTITY_CONFLICT_VIN',
                ruleName: 'Vehicle Document VIN Contradicts Registration VIN',
                category: 'IDENTITY_CONFLICT',
                severity: 'HIGH',
                primaryEntityId: v.id,
                primaryEntityType: 'VEHICLE',
                title: `Document VIN Contradiction on ${v.passportId}`,
                description: `Document "${d.title}" contains OCR VIN (${ext.vin}) which directly conflicts with vehicle registered VIN (${v.vin}).`,
                explanation: `OCR extraction from ${d.documentType} (ID: ${d.id}) yielded VIN "${ext.vin}", whereas the vehicle registration has "${v.vin}".`,
                unknowns: 'Scanning OCR transcription error vs vehicle identity cloning / counterfeit documentation.',
                recommendedAction: 'Request original physical document and verify stamped chassis number.',
                involvedNodeKeys: [`VEHICLE:${v.id}`, `DOCUMENT:${d.id}`],
                evidenceReferences: [
                  {
                    recordType: 'Vehicle',
                    recordId: v.id,
                    field: 'vin',
                    expected: v.vin,
                    actual: v.vin,
                  },
                  {
                    recordType: 'VehicleDocument',
                    recordId: d.id,
                    field: 'extractedData.vin',
                    expected: v.vin,
                    actual: ext.vin,
                  },
                ],
              });
            }
          } catch {}
        }
      }
    }

    // ------------------------------------------------------------------------
    // RULE C: DOCUMENT-TO-RECORD INCONSISTENCY (OCR Extraction)
    // ------------------------------------------------------------------------
    const docs = await prisma.vehicleDocument.findMany({
      include: {
        vehicle: {
          include: {
            serviceRecords: true,
          },
        },
      },
    });

    for (const d of docs) {
      let isMismatch = d.consistencyStatus === 'INCONSISTENT' || d.consistencyStatus === 'TAMPERED';
      let mismatchDetails = `Automated consistency verification flagged ${d.documentType} document (ID: ${d.id}).`;

      if (!isMismatch && d.extractedData) {
        try {
          const ext = JSON.parse(d.extractedData);
          if (ext.mileage && d.vehicle.serviceRecords.length > 0) {
            // If document specifies mileage, compare with service records
            const maxServiceMileage = Math.max(...d.vehicle.serviceRecords.map((s) => s.mileage));
            if (Math.abs(ext.mileage - maxServiceMileage) > 20000) {
              isMismatch = true;
              mismatchDetails = `Document specifies mileage of ${ext.mileage.toLocaleString()} km, which materially deviates from registered service mileage (${maxServiceMileage.toLocaleString()} km).`;
            }
          }
        } catch {}
      }

      if (isMismatch) {
        candidateFindings.push({
          ruleId: 'RULE_DOCUMENT_MISMATCH',
          ruleName: 'Document Content Conflicts with Vehicle Database Record',
          category: 'DOCUMENT_TAMPER',
          severity: 'MEDIUM',
          primaryEntityId: d.vehicleId,
          primaryEntityType: 'VEHICLE',
          title: `Document Inconsistency Detected: ${d.title}`,
          description: `Extracted OCR metadata from ${d.documentType} document conflicts with authoritative vehicle records.`,
          explanation: mismatchDetails,
          unknowns: 'OCR image quality artifacts vs genuine counterfeit document.',
          recommendedAction: 'Conduct manual visual inspection of uploaded document PDF against registration authority records.',
          involvedNodeKeys: [`VEHICLE:${d.vehicleId}`, `DOCUMENT:${d.id}`],
          evidenceReferences: [
            {
              recordType: 'VehicleDocument',
              recordId: d.id,
              field: 'consistencyStatus',
              expected: 'CONSISTENT',
              actual: d.consistencyStatus,
              hash: d.fileHash,
            },
          ],
        });
      }
    }

    // ------------------------------------------------------------------------
    // RULE D: LIFECYCLE CHRONOLOGY CONFLICTS
    // ------------------------------------------------------------------------
    const vehiclesWithChronology = await prisma.vehicle.findMany({
      include: {
        manufacturerCertificate: true,
        serviceRecords: true,
        accidentRecords: true,
      },
    });

    for (const v of vehiclesWithChronology) {
      const birthDate = v.manufacturerCertificate?.manufacturingDate || new Date(v.manufacturingYear, 0, 1);

      // Check service dates before manufacturing date
      for (const s of v.serviceRecords) {
        if (s.serviceDate < birthDate) {
          candidateFindings.push({
            ruleId: 'RULE_LIFECYCLE_CHRONOLOGY_PRE_BIRTH',
            ruleName: 'Service Record Predates Vehicle Manufacturing Date',
            category: 'CHRONOLOGY_VIOLATION',
            severity: 'HIGH',
            primaryEntityId: v.id,
            primaryEntityType: 'VEHICLE',
            title: `Anachronistic Service Record on ${v.passportId}`,
            description: `Service record logged on ${s.serviceDate.toISOString().slice(0, 10)} predates vehicle manufacturing date ${birthDate.toISOString().slice(0, 10)}.`,
            explanation: `A vehicle cannot undergo routine servicing prior to factory assembly and initial delivery. This indicates erroneous date entry or forged historical log.`,
            unknowns: 'Source date transcription error at the servicing facility.',
            recommendedAction: 'Contact servicing garage to confirm physical job card timestamp.',
            involvedNodeKeys: [`VEHICLE:${v.id}`, `SERVICE_RECORD:${s.id}`],
            evidenceReferences: [
              {
                recordType: 'ServiceRecord',
                recordId: s.id,
                field: 'serviceDate',
                expected: `>= ${birthDate.toISOString().slice(0, 10)}`,
                actual: s.serviceDate.toISOString().slice(0, 10),
              },
            ],
          });
        }
      }
    }

    // ------------------------------------------------------------------------
    // RULE E: CROSS-VEHICLE SHARED DOCUMENT CLONING (Cross-Entity Pattern)
    // ------------------------------------------------------------------------
    const docHashGroups = await prisma.vehicleDocument.groupBy({
      by: ['fileHash'],
      _count: { vehicleId: true },
      where: { fileHash: { not: '' } },
    });

    for (const group of docHashGroups) {
      if (group._count.vehicleId > 1) {
        const matchingDocs = await prisma.vehicleDocument.findMany({
          where: { fileHash: group.fileHash },
          include: { vehicle: true },
        });

        const distinctVehicleIds = Array.from(new Set(matchingDocs.map((d) => d.vehicleId)));
        if (distinctVehicleIds.length > 1) {
          const vPassports = matchingDocs.map((d) => d.vehicle.passportId).join(', ');
          candidateFindings.push({
            ruleId: 'RULE_CROSS_VEHICLE_DOCUMENT_CLONING',
            ruleName: 'Cross-Vehicle Identical Document Cloning',
            category: 'CROSS_VEHICLE_PATTERN',
            severity: 'HIGH',
            primaryEntityId: distinctVehicleIds[0],
            primaryEntityType: 'VEHICLE',
            title: `Duplicate Document File Hash Shared Across ${distinctVehicleIds.length} Vehicles`,
            description: `Exact same cryptographic file hash (${group.fileHash.slice(0, 16)}...) was uploaded to multiple separate vehicles: ${vPassports}.`,
            explanation: `Document cryptographic fingerprint matching detected across multiple vehicle passports. Unless these are generic warranty brochures, identical registration or insurance documents across distinct VINs indicate potential document re-use or cloning.`,
            unknowns: 'Whether document is a non-unique generic disclaimer or an official title certificate.',
            recommendedAction: 'Inspect document titles and determine if certificate numbers were duplicated.',
            involvedNodeKeys: distinctVehicleIds.map((id) => `VEHICLE:${id}`),
            evidenceReferences: matchingDocs.map((d) => ({
              recordType: 'VehicleDocument',
              recordId: d.id,
              field: 'fileHash',
              expected: 'Unique per vehicle document',
              actual: group.fileHash,
              notes: `Linked to passport ${d.vehicle.passportId}`,
            })),
          });
        }
      }
    }

    // ------------------------------------------------------------------------
    // RULE F: ACCIDENT & INSURANCE CLAIM POLICY MISMATCH
    // ------------------------------------------------------------------------
    const claims = await prisma.insuranceClaimRecord.findMany({
      include: {
        insuranceRecord: { include: { vehicle: true } },
      },
    });

    for (const c of claims) {
      if (c.accidentRecordId) {
        const accident = await prisma.accidentRecord.findUnique({
          where: { id: c.accidentRecordId },
        });

        if (accident && accident.vehicleId !== c.insuranceRecord.vehicleId) {
          candidateFindings.push({
            ruleId: 'RULE_CROSS_VEHICLE_CLAIM_MISMATCH',
            ruleName: 'Insurance Claim Linked to Unrelated Vehicle Accident',
            category: 'CROSS_VEHICLE_PATTERN',
            severity: 'HIGH',
            primaryEntityId: c.insuranceRecord.vehicleId,
            primaryEntityType: 'VEHICLE',
            title: `Cross-Vehicle Claim Contradiction for Claim #${c.claimNumber}`,
            description: `Claim was filed under Policy for Vehicle ${c.insuranceRecord.vehicle.passportId}, but is linked to Accident on a different vehicle (ID: ${accident.vehicleId}).`,
            explanation: `Relational graph analysis identified an inconsistent cross-entity edge. The insurance claim references an accident event registered under a different vehicle passport.`,
            unknowns: 'Typographical claim association error vs phantom claim submission.',
            recommendedAction: 'Notify insurance claims investigator and audit claim intake form.',
            involvedNodeKeys: [
              `VEHICLE:${c.insuranceRecord.vehicleId}`,
              `INSURANCE_CLAIM:${c.id}`,
              `ACCIDENT_RECORD:${accident.id}`,
            ],
            evidenceReferences: [
              {
                recordType: 'InsuranceClaimRecord',
                recordId: c.id,
                field: 'accidentVehicleId',
                expected: c.insuranceRecord.vehicleId,
                actual: accident.vehicleId,
              },
            ],
          });
        }
      }
    }

    // ------------------------------------------------------------------------
    // RULE G: BLOCKCHAIN & MERKLE INTEGRITY VERIFICATION
    // ------------------------------------------------------------------------
    const batchedRecords = await prisma.merkleBatchRecord.findMany({
      take: 20,
      include: { batch: true },
    });

    for (const br of batchedRecords) {
      // Recompute canonical hash from live DB
      const liveHash = await this.batchService.recomputeRecordHash(br.recordId, br.recordType);
      if (liveHash && liveHash.toLowerCase() !== br.recordHashSnapshot.toLowerCase()) {
        candidateFindings.push({
          ruleId: 'RULE_BLOCKCHAIN_INTEGRITY_TAMPER',
          ruleName: 'Database Record Altered Post-Merkle Anchoring',
          category: 'BLOCKCHAIN_VERIFICATION',
          severity: 'HIGH',
          primaryEntityId: br.vehicleId || br.recordId,
          primaryEntityType: 'RECORD',
          title: `Post-Anchor Modification Detected on ${br.recordType} Record`,
          description: `Current database content does not match the cryptographic snapshot committed in Merkle Batch ${br.batch.batchIdentifier}.`,
          explanation: `The canonical SHA-256 hash calculated from current database values (${liveHash.slice(0, 16)}...) differs from the immutable hash committed to Merkle Root ${br.batch.merkleRoot.slice(0, 16)}... anchored on-chain in transaction ${br.batch.transactionHash}.`,
          unknowns: 'Unauthorized direct database mutation or uncommitted retroactive edit.',
          recommendedAction: 'Restore record from cryptographic snapshot or open formal administrative tamper case.',
          involvedNodeKeys: [`MERKLE_BATCH:${br.batchId}`, `${br.recordType}_RECORD:${br.recordId}`],
          evidenceReferences: [
            {
              recordType: br.recordType,
              recordId: br.recordId,
              field: 'canonicalHash',
              expected: br.recordHashSnapshot,
              actual: liveHash,
              notes: `Committed in batch ${br.batch.batchIdentifier}`,
            },
          ],
        });
      }
    }

    // ------------------------------------------------------------------------
    // PERSIST / UPSERT FINDINGS TO DATABASE
    // ------------------------------------------------------------------------
    for (let i = 0; i < candidateFindings.length; i++) {
      const c = candidateFindings[i];
      const findingKey = makeFindingKey(c.ruleId, c.primaryEntityId);
      const existingId = existingKeyMap.get(findingKey);

      if (existingId) {
        await prisma.fraudFinding.update({
          where: { id: existingId },
          data: {
            title: c.title,
            description: c.description,
            explanation: c.explanation,
            unknowns: c.unknowns,
            recommendedAction: c.recommendedAction,
            evidenceReferences: JSON.stringify(c.evidenceReferences),
            involvedNodeIds: JSON.stringify(c.involvedNodeKeys || []),
            lastEvaluatedAt: new Date(),
          },
        });
        findingsUpdated++;
      } else {
        const rand = Math.floor(1000 + Math.random() * 9000);
        const findingNumber = `FINDING-2026-${Date.now().toString().slice(-6)}${rand}`;
        await prisma.fraudFinding.create({
          data: {
            findingNumber,
            ruleId: c.ruleId,
            ruleVersion: c.ruleVersion || '1.0',
            ruleName: c.ruleName,
            category: c.category,
            severity: c.severity,
            status: c.status || 'NEW',
            primaryEntityId: c.primaryEntityId,
            primaryEntityType: c.primaryEntityType,
            title: c.title,
            description: c.description,
            explanation: c.explanation,
            unknowns: c.unknowns,
            recommendedAction: c.recommendedAction,
            involvedNodeIds: JSON.stringify(c.involvedNodeKeys || []),
            evidenceReferences: JSON.stringify(c.evidenceReferences),
            firstDetectedAt: new Date(),
            lastEvaluatedAt: new Date(),
          },
        });
        findingsCreated++;
      }
    }

    const durationMs = Math.round(performance.now() - startTime);
    const totalFindingsActive = await prisma.fraudFinding.count({
      where: { status: { in: ['NEW', 'UNDER_REVIEW', 'NEEDS_MORE_EVIDENCE'] } },
    });

    return {
      findingsCreated,
      findingsUpdated,
      totalFindingsActive,
      rulesEvaluated: 8,
      durationMs,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Evaluates rules across platform and returns findings relevant to a specific vehicle
   */
  public async evaluateVehicle(vehicleId: string) {
    await this.evaluateAllRules();
    return prisma.fraudFinding.findMany({
      where: { primaryEntityId: vehicleId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const fraudRulesEngine = FraudRulesEngine.getInstance();

