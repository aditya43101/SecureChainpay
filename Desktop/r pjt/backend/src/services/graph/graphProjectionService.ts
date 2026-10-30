import { prisma } from '../../lib/prisma';

export interface GraphSyncResult {
  nodesUpserted: number;
  edgesUpserted: number;
  durationMs: number;
  timestamp: string;
}

export class GraphProjectionService {
  private static instance: GraphProjectionService;

  public static getInstance(): GraphProjectionService {
    if (!GraphProjectionService.instance) {
      GraphProjectionService.instance = new GraphProjectionService();
    }
    return GraphProjectionService.instance;
  }

  /**
   * Completely projects authoritative PostgreSQL records into GraphNode & GraphEdge tables
   * Designed to be strictly idempotent, non-destructive, and deterministic.
   */
  public async reconcileAll(): Promise<GraphSyncResult> {
    return this.syncEntireGraph();
  }

  public async syncEntireGraph(): Promise<GraphSyncResult> {
    const startTime = performance.now();
    let nodesCount = 0;
    let edgesCount = 0;

    // Update sync metadata to SYNCING
    await prisma.graphSyncMetadata.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', status: 'SYNCING' },
      update: { status: 'SYNCING', lastError: null },
    });

    try {
      // Node Key -> Node ID lookup map
      const nodeKeyToId = new Map<string, string>();

      const upsertNode = async (params: {
        nodeKey: string;
        entityType: string;
        entityId: string;
        label: string;
        metadata?: any;
        sourceRecordHash?: string | null;
        isAnchored?: boolean;
        anomalyScore?: number;
      }): Promise<string> => {
        const node = await prisma.graphNode.upsert({
          where: { nodeKey: params.nodeKey },
          create: {
            nodeKey: params.nodeKey,
            entityType: params.entityType,
            entityId: params.entityId,
            label: params.label,
            metadata: params.metadata ? JSON.stringify(params.metadata) : null,
            sourceRecordHash: params.sourceRecordHash || null,
            isAnchored: params.isAnchored ?? false,
            anomalyScore: params.anomalyScore ?? 0.0,
            lastSyncedAt: new Date(),
          },
          update: {
            label: params.label,
            metadata: params.metadata ? JSON.stringify(params.metadata) : null,
            sourceRecordHash: params.sourceRecordHash || null,
            isAnchored: params.isAnchored ?? false,
            lastSyncedAt: new Date(),
          },
        });
        nodeKeyToId.set(params.nodeKey, node.id);
        nodesCount++;
        return node.id;
      };

      const upsertEdge = async (params: {
        sourceKey: string;
        targetKey: string;
        relationshipType: string;
        isDirect?: boolean;
        isInferred?: boolean;
        confidence?: number;
        sourceReference?: string;
        evidence?: any;
      }) => {
        const sourceNodeId = nodeKeyToId.get(params.sourceKey);
        const targetNodeId = nodeKeyToId.get(params.targetKey);
        if (!sourceNodeId || !targetNodeId) return;

        await prisma.graphEdge.upsert({
          where: {
            sourceNodeId_targetNodeId_relationshipType: {
              sourceNodeId,
              targetNodeId,
              relationshipType: params.relationshipType,
            },
          },
          create: {
            sourceNodeId,
            targetNodeId,
            relationshipType: params.relationshipType,
            isDirect: params.isDirect ?? true,
            isInferred: params.isInferred ?? false,
            confidence: params.confidence ?? 1.0,
            sourceReference: params.sourceReference,
            evidence: params.evidence ? JSON.stringify(params.evidence) : null,
          },
          update: {
            confidence: params.confidence ?? 1.0,
            evidence: params.evidence ? JSON.stringify(params.evidence) : null,
          },
        });
        edgesCount++;
      };

      // 1. PROJECT USERS & STAKEHOLDERS
      const users = await prisma.user.findMany();
      for (const u of users) {
        let entityType = 'USER';
        if (u.role === 'GARAGE') entityType = 'GARAGE';
        else if (u.role === 'MANUFACTURER') entityType = 'MANUFACTURER';
        else if (u.role === 'INSURANCE_PROVIDER') entityType = 'INSURANCE_PROVIDER';

        const nodeKey = `${entityType}:${u.id}`;
        await upsertNode({
          nodeKey,
          entityType,
          entityId: u.id,
          label: `${u.name} (${u.role})`,
          metadata: {
            name: u.name,
            role: u.role,
            email: u.email,
            blockchainUserId: u.blockchainUserId,
            isInitialized: u.isInitialized,
          },
          isAnchored: Boolean(u.blockchainTxHash),
        });
      }

      // 2. PROJECT VEHICLES
      const vehicles = await prisma.vehicle.findMany({
        include: {
          currentOwner: true,
          manufacturerCertificate: true,
          batteryPassport: true,
        },
      });

      for (const v of vehicles) {
        const vKey = `VEHICLE:${v.id}`;
        await upsertNode({
          nodeKey: vKey,
          entityType: 'VEHICLE',
          entityId: v.id,
          label: `${v.manufacturer} ${v.model} (${v.passportId})`,
          metadata: {
            passportId: v.passportId,
            vin: v.vin,
            registrationNumber: v.registrationNumber,
            manufacturer: v.manufacturer,
            model: v.model,
            manufacturingYear: v.manufacturingYear,
            fuelType: v.fuelType,
            status: v.status,
            blockchainVehicleId: v.blockchainVehicleId,
          },
          sourceRecordHash: v.recordHash,
          isAnchored: v.blockchainStatus === 'CONFIRMED',
        });

        // Edge: OWNS (User -> Vehicle)
        if (v.currentOwnerId) {
          const ownerKey = `USER:${v.currentOwnerId}`;
          if (nodeKeyToId.has(ownerKey)) {
            await upsertEdge({
              sourceKey: ownerKey,
              targetKey: vKey,
              relationshipType: 'OWNS',
              sourceReference: 'Vehicle.currentOwnerId',
            });
          }
        }

        // Edge: MANUFACTURED_BY (Vehicle -> Manufacturer User if manufacturer certificate exists)
        if (v.manufacturerCertificate?.manufacturerId) {
          const mfgKey = `MANUFACTURER:${v.manufacturerCertificate.manufacturerId}`;
          if (nodeKeyToId.has(mfgKey)) {
            await upsertEdge({
              sourceKey: vKey,
              targetKey: mfgKey,
              relationshipType: 'MANUFACTURED_BY',
              sourceReference: 'ManufacturerCertificate.manufacturerId',
              evidence: {
                certificateNumber: v.manufacturerCertificate.certificateNumber,
                manufacturingDate: v.manufacturerCertificate.manufacturingDate,
              },
            });
          }
        }
      }

      // 3. PROJECT OWNERSHIP TRANSFERS
      const transfers = await prisma.ownershipHistory.findMany();
      for (const t of transfers) {
        const vKey = `VEHICLE:${t.vehicleId}`;
        const prevOwnerKey = t.previousOwnerId ? `USER:${t.previousOwnerId}` : null;
        const newOwnerKey = `USER:${t.newOwnerId}`;

        if (prevOwnerKey && nodeKeyToId.has(prevOwnerKey) && nodeKeyToId.has(newOwnerKey)) {
          await upsertEdge({
            sourceKey: prevOwnerKey,
            targetKey: newOwnerKey,
            relationshipType: 'TRANSFERRED_TO',
            sourceReference: `OwnershipHistory:${t.id}`,
            evidence: {
              vehicleId: t.vehicleId,
              transferType: t.transferType,
              transferDate: t.transferDate,
              recordHash: t.recordHash,
            },
          });
        }
      }

      // 4. PROJECT SERVICE RECORDS
      const services = await prisma.serviceRecord.findMany();
      for (const s of services) {
        const sKey = `SERVICE_RECORD:${s.id}`;
        await upsertNode({
          nodeKey: sKey,
          entityType: 'SERVICE_RECORD',
          entityId: s.id,
          label: `Service: ${s.serviceType} (${s.mileage} km)`,
          metadata: {
            serviceType: s.serviceType,
            mileage: s.mileage,
            serviceDate: s.serviceDate,
            cost: s.cost,
            partsReplaced: s.partsReplaced,
          },
          sourceRecordHash: s.recordHash,
          isAnchored: Boolean(s.blockchainTxHash),
        });

        // Edge: HAS_SERVICE_RECORD (Vehicle -> ServiceRecord)
        const vKey = `VEHICLE:${s.vehicleId}`;
        await upsertEdge({
          sourceKey: vKey,
          targetKey: sKey,
          relationshipType: 'HAS_SERVICE_RECORD',
          sourceReference: `ServiceRecord:${s.id}`,
        });

        // Edge: SERVICED_BY (ServiceRecord -> Garage User)
        const gKey = `GARAGE:${s.garageId}`;
        if (nodeKeyToId.has(gKey)) {
          await upsertEdge({
            sourceKey: sKey,
            targetKey: gKey,
            relationshipType: 'SERVICED_BY',
            sourceReference: `ServiceRecord:${s.id}`,
          });
        }
      }

      // 5. PROJECT ODOMETER RECORDS
      const odometers = await prisma.odometerRecord.findMany();
      for (const o of odometers) {
        const oKey = `ODOMETER_RECORD:${o.id}`;
        await upsertNode({
          nodeKey: oKey,
          entityType: 'ODOMETER_RECORD',
          entityId: o.id,
          label: `Odometer: ${o.mileage} km (${o.sourceType})`,
          metadata: {
            mileage: o.mileage,
            recordedAt: o.recordedAt,
            sourceType: o.sourceType,
          },
          sourceRecordHash: o.recordHash,
          isAnchored: Boolean(o.blockchainTxHash),
        });

        const vKey = `VEHICLE:${o.vehicleId}`;
        await upsertEdge({
          sourceKey: vKey,
          targetKey: oKey,
          relationshipType: 'HAS_ODOMETER_RECORD',
          sourceReference: `OdometerRecord:${o.id}`,
        });
      }

      // 6. PROJECT ACCIDENT & REPAIR RECORDS
      const accidents = await prisma.accidentRecord.findMany();
      for (const a of accidents) {
        const aKey = `ACCIDENT_RECORD:${a.id}`;
        await upsertNode({
          nodeKey: aKey,
          entityType: 'ACCIDENT_RECORD',
          entityId: a.id,
          label: `Accident: ${a.severity} (${a.accidentDate.toISOString().slice(0, 10)})`,
          metadata: {
            severity: a.severity,
            accidentDate: a.accidentDate,
            description: a.description,
            repairStatus: a.repairStatus,
          },
          sourceRecordHash: a.recordHash,
          isAnchored: Boolean(a.blockchainTxHash),
        });

        const vKey = `VEHICLE:${a.vehicleId}`;
        await upsertEdge({
          sourceKey: vKey,
          targetKey: aKey,
          relationshipType: 'HAS_ACCIDENT',
          sourceReference: `AccidentRecord:${a.id}`,
        });
      }

      // 7. PROJECT INSURANCE RECORDS & CLAIMS
      const insurances = await prisma.insuranceRecord.findMany({
        include: { claims: true },
      });
      for (const ins of insurances) {
        const insKey = `INSURANCE_RECORD:${ins.id}`;
        await upsertNode({
          nodeKey: insKey,
          entityType: 'INSURANCE_RECORD',
          entityId: ins.id,
          label: `Policy: ${ins.policyReference} (${ins.coverageType})`,
          metadata: {
            policyReference: ins.policyReference,
            coverageType: ins.coverageType,
            startDate: ins.startDate,
            endDate: ins.endDate,
            status: ins.status,
          },
          sourceRecordHash: ins.recordHash,
          isAnchored: Boolean(ins.blockchainTxHash),
        });

        const vKey = `VEHICLE:${ins.vehicleId}`;
        await upsertEdge({
          sourceKey: vKey,
          targetKey: insKey,
          relationshipType: 'HAS_INSURANCE_POLICY',
          sourceReference: `InsuranceRecord:${ins.id}`,
        });

        const provKey = `INSURANCE_PROVIDER:${ins.providerId}`;
        if (nodeKeyToId.has(provKey)) {
          await upsertEdge({
            sourceKey: insKey,
            targetKey: provKey,
            relationshipType: 'ISSUED_BY',
            sourceReference: `InsuranceRecord:${ins.id}`,
          });
        }

        // Project Claims
        for (const claim of ins.claims) {
          const claimKey = `INSURANCE_CLAIM:${claim.id}`;
          await upsertNode({
            nodeKey: claimKey,
            entityType: 'INSURANCE_CLAIM',
            entityId: claim.id,
            label: `Claim: ${claim.claimNumber} (${claim.claimStatus})`,
            metadata: {
              claimNumber: claim.claimNumber,
              claimAmount: claim.claimAmount,
              status: claim.claimStatus,
              claimDate: claim.claimDate,
              description: claim.description,
            },
            sourceRecordHash: claim.recordHash,
            isAnchored: Boolean(claim.blockchainTxHash),
          });

          // Edge: CLAIM_BELONGS_TO_POLICY
          await upsertEdge({
            sourceKey: claimKey,
            targetKey: insKey,
            relationshipType: 'BELONGS_TO_POLICY',
            sourceReference: `InsuranceClaimRecord:${claim.id}`,
          });

          // Edge: CLAIM_RELATES_TO_ACCIDENT
          if (claim.accidentRecordId) {
            const aKey = `ACCIDENT_RECORD:${claim.accidentRecordId}`;
            if (nodeKeyToId.has(aKey)) {
              await upsertEdge({
                sourceKey: claimKey,
                targetKey: aKey,
                relationshipType: 'CLAIM_RELATES_TO_ACCIDENT',
                sourceReference: `InsuranceClaimRecord:${claim.id}`,
                evidence: {
                  accidentRecordId: claim.accidentRecordId,
                  claimDate: claim.claimDate,
                },
              });
            }
          }
        }
      }

      // 8. PROJECT VEHICLE DOCUMENTS
      const documents = await prisma.vehicleDocument.findMany();
      for (const d of documents) {
        const dKey = `DOCUMENT:${d.id}`;
        await upsertNode({
          nodeKey: dKey,
          entityType: 'DOCUMENT',
          entityId: d.id,
          label: `Document: ${d.title} (${d.documentType})`,
          metadata: {
            title: d.title,
            documentType: d.documentType,
            fileHash: d.fileHash,
            consistencyStatus: d.consistencyStatus,
          },
          sourceRecordHash: d.recordHash,
          isAnchored: Boolean(d.blockchainTxHash),
        });

        const vKey = `VEHICLE:${d.vehicleId}`;
        await upsertEdge({
          sourceKey: dKey,
          targetKey: vKey,
          relationshipType: 'DOCUMENT_SUPPORTS_RECORD',
          sourceReference: `VehicleDocument:${d.id}`,
        });
      }

      // 9. PROJECT PHASE 6 MERKLE BATCHES
      const batches = await prisma.merkleBatch.findMany({
        include: { records: true },
      });
      for (const b of batches) {
        const bKey = `MERKLE_BATCH:${b.id}`;
        await upsertNode({
          nodeKey: bKey,
          entityType: 'MERKLE_BATCH',
          entityId: b.id,
          label: `Batch ${b.batchIdentifier} (${b.leafCount} records)`,
          metadata: {
            batchIdentifier: b.batchIdentifier,
            merkleRoot: b.merkleRoot,
            leafCount: b.leafCount,
            status: b.status,
            blockNumber: b.blockNumber,
            transactionHash: b.transactionHash,
          },
          sourceRecordHash: b.merkleRoot,
          isAnchored: b.status === 'CONFIRMED',
        });

        // Link individual batched lifecycle records to the batch node
        for (const r of b.records) {
          // Identify source record node
          let recNodeKey: string | null = null;
          if (r.recordType === 'SERVICE') recNodeKey = `SERVICE_RECORD:${r.recordId}`;
          else if (r.recordType === 'ODOMETER') recNodeKey = `ODOMETER_RECORD:${r.recordId}`;
          else if (r.recordType === 'ACCIDENT') recNodeKey = `ACCIDENT_RECORD:${r.recordId}`;
          else if (r.recordType === 'INSURANCE') recNodeKey = `INSURANCE_RECORD:${r.recordId}`;
          else if (r.recordType === 'DOCUMENT') recNodeKey = `DOCUMENT:${r.recordId}`;

          if (recNodeKey && nodeKeyToId.has(recNodeKey)) {
            await upsertEdge({
              sourceKey: recNodeKey,
              targetKey: bKey,
              relationshipType: 'INCLUDED_IN_MERKLE_BATCH',
              sourceReference: `MerkleBatchRecord:${r.id}`,
              evidence: {
                leafIndex: r.leafIndex,
                leafHash: r.leafHash,
                snapshotHash: r.recordHashSnapshot,
              },
            });
          }
        }
      }

      // 10. PROJECT LEGITIMATE SHARED RELATIONSHIPS (Non-Fraud Inferred Edges)
      // Connect vehicles that share the same legitimate servicing garage
      const garages = await prisma.user.findMany({
        where: { role: 'GARAGE' },
        include: { garageServices: { select: { vehicleId: true } } },
      });

      for (const g of garages) {
        const uniqueVehicles = Array.from(new Set(g.garageServices.map((s) => s.vehicleId)));
        if (uniqueVehicles.length > 1) {
          // Add informational inferred edge between vehicles: SHARES_EVIDENCE_WITH (Legitimate)
          for (let i = 0; i < uniqueVehicles.length; i++) {
            for (let j = i + 1; j < uniqueVehicles.length; j++) {
              const vKey1 = `VEHICLE:${uniqueVehicles[i]}`;
              const vKey2 = `VEHICLE:${uniqueVehicles[j]}`;
              if (nodeKeyToId.has(vKey1) && nodeKeyToId.has(vKey2)) {
                await upsertEdge({
                  sourceKey: vKey1,
                  targetKey: vKey2,
                  relationshipType: 'SHARES_EVIDENCE_WITH',
                  isDirect: false,
                  isInferred: true,
                  confidence: 0.95,
                  sourceReference: `Garage:${g.id}`,
                  evidence: {
                    type: 'LEGITIMATE_SHARED_GARAGE',
                    garageName: g.name,
                    notes: 'Vehicles serviced by the same certified automotive facility. Normal commercial pattern.',
                  },
                });
              }
            }
          }
        }
      }

      const durationMs = Math.round(performance.now() - startTime);

      // Count total current findings
      const findingCount = await prisma.fraudFinding.count();

      // Update sync metadata
      await prisma.graphSyncMetadata.upsert({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          nodeCount: nodesCount,
          edgeCount: edgesCount,
          findingCount,
          status: 'IDLE',
          syncDurationMs: durationMs,
          lastSyncedAt: new Date(),
        },
        update: {
          nodeCount: nodesCount,
          edgeCount: edgesCount,
          findingCount,
          status: 'IDLE',
          syncDurationMs: durationMs,
          lastSyncedAt: new Date(),
        },
      });

      return {
        nodesUpserted: nodesCount,
        edgesUpserted: edgesCount,
        durationMs,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      await prisma.graphSyncMetadata.upsert({
        where: { id: 'singleton' },
        create: { id: 'singleton', status: 'ERROR', lastError: err.message },
        update: { status: 'ERROR', lastError: err.message },
      });
      throw err;
    }
  }

  /**
   * Returns current high-level graph statistics
   */
  public async getGraphStats() {
    const meta = await prisma.graphSyncMetadata.findUnique({ where: { id: 'singleton' } });
    const totalNodes = await prisma.graphNode.count();
    const totalEdges = await prisma.graphEdge.count();
    const nodeTypeDistribution = await prisma.graphNode.groupBy({
      by: ['entityType'],
      _count: true,
    });
    const edgeTypeDistribution = await prisma.graphEdge.groupBy({
      by: ['relationshipType'],
      _count: true,
    });

    return {
      totalNodes,
      totalEdges,
      lastSyncedAt: meta?.lastSyncedAt?.toISOString() || null,
      status: meta?.status || 'IDLE',
      syncDurationMs: meta?.syncDurationMs || 0,
      nodeTypeDistribution: nodeTypeDistribution.map((d) => ({
        type: d.entityType,
        count: d._count,
      })),
      edgeTypeDistribution: edgeTypeDistribution.map((d) => ({
        type: d.relationshipType,
        count: d._count,
      })),
    };
  }
}

export const graphProjectionService = GraphProjectionService.getInstance();

