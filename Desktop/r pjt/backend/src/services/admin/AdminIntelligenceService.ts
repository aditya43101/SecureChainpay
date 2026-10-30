import { prisma } from '../../lib/prisma';
import { getBlockchainConfig } from '../../blockchain/config';
import { logAuditEvent } from '../auditService';
import { ethers } from 'ethers';

export interface AdminCaseInput {
  vehicleId?: string;
  category: string; // TAMPER_DETECTION, ODOMETER_ANOMALY, DOCUMENT_MISMATCH, BLOCKCHAIN_MISMATCH, SUSPICIOUS_RECORD
  title: string;
  description: string;
  severity?: string; // LOW, MEDIUM, HIGH, CRITICAL
  evidence?: any;
}

export interface AdminCaseUpdateInput {
  status?: string; // OPEN, UNDER_REVIEW, RESOLVED, DISMISSED
  resolutionNotes?: string;
  assignedToId?: string;
}

export class AdminIntelligenceService {
  /**
   * System-wide factual metrics & operational summary
   */
  async getSystemOverview() {
    const [
      totalUsers,
      usersByRole,
      totalVehicles,
      vehiclesByStatus,
      vehiclesByFuel,
      totalBlockchainRecords,
      blockchainByStatus,
      totalDocuments,
      documentsByConsistency,
      totalServices,
      totalOdometer,
      totalAccidents,
      totalInsurances,
      totalMfrCerts,
      totalBatteryPassports,
      totalGarages,
      verificationAuditCount,
      tamperAuditCount,
      openCasesCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({ by: ['role'], _count: { id: true } }),
      prisma.vehicle.count(),
      prisma.vehicle.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.vehicle.groupBy({ by: ['fuelType'], _count: { id: true } }),
      prisma.blockchainRecord.count(),
      prisma.blockchainRecord.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.vehicleDocument.count(),
      prisma.vehicleDocument.groupBy({ by: ['consistencyStatus'], _count: { id: true } }),
      prisma.serviceRecord.count(),
      prisma.odometerRecord.count(),
      prisma.accidentRecord.count(),
      prisma.insuranceRecord.count(),
      prisma.manufacturerCertificate.count(),
      prisma.batteryPassport.count(),
      prisma.garageProfile.count(),
      prisma.auditLog.count({ where: { action: 'VEHICLE_VERIFICATION' } }),
      prisma.auditLog.count({ where: { action: 'TAMPER_DETECTED' } }),
      prisma.adminCase.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
    ]);

    const roleMap: Record<string, number> = {};
    usersByRole.forEach((r) => (roleMap[r.role] = r._count.id));

    const statusMap: Record<string, number> = {};
    vehiclesByStatus.forEach((s) => (statusMap[s.status] = s._count.id));

    const fuelMap: Record<string, number> = {};
    vehiclesByFuel.forEach((f) => (fuelMap[f.fuelType] = f._count.id));

    const chainStatusMap: Record<string, number> = {};
    blockchainByStatus.forEach((b) => (chainStatusMap[b.status] = b._count.id));

    const docConsistencyMap: Record<string, number> = {};
    documentsByConsistency.forEach((d) => (docConsistencyMap[d.consistencyStatus || 'UNKNOWN'] = d._count.id));

    return {
      users: {
        total: totalUsers,
        byRole: roleMap,
      },
      vehicles: {
        total: totalVehicles,
        byStatus: statusMap,
        byFuel: fuelMap,
      },
      blockchain: {
        totalRecords: totalBlockchainRecords,
        confirmed: chainStatusMap['CONFIRMED'] || 0,
        pending: chainStatusMap['PENDING'] || 0,
        failed: chainStatusMap['FAILED'] || 0,
      },
      documents: {
        total: totalDocuments,
        byConsistency: docConsistencyMap,
      },
      lifecycleCounts: {
        services: totalServices,
        odometerReadings: totalOdometer,
        accidents: totalAccidents,
        insurances: totalInsurances,
        manufacturerCertificates: totalMfrCerts,
        batteryPassports: totalBatteryPassports,
        certifiedGarages: totalGarages,
      },
      trustAndIntegrity: {
        totalVerificationQueries: verificationAuditCount,
        tamperDetectionsLogged: tamperAuditCount,
        activeAdminCases: openCasesCount,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Deep blockchain analytics & smart contract telemetry
   */
  async getBlockchainAnalytics() {
    const config = getBlockchainConfig();
    let currentBlockNumber = 0;
    let isNodeOnline = false;

    if (config.rpcUrl) {
      try {
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        currentBlockNumber = await provider.getBlockNumber();
        isNodeOnline = true;
      } catch (err) {
        console.warn('Blockchain node connectivity check failed:', err);
      }
    }

    const [totalRecords, recordsByType, recordsByStatus, recentTransactions] = await Promise.all([
      prisma.blockchainRecord.count(),
      prisma.blockchainRecord.groupBy({ by: ['recordType'], _count: { id: true } }),
      prisma.blockchainRecord.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.blockchainRecord.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        include: {
          vehicle: { select: { passportId: true, manufacturer: true, model: true } },
        },
      }),
    ]);

    const typeBreakdown: Record<string, number> = {};
    recordsByType.forEach((t) => (typeBreakdown[t.recordType] = t._count.id));

    const statusBreakdown: Record<string, number> = {};
    recordsByStatus.forEach((s) => (statusBreakdown[s.status] = s._count.id));

    return {
      network: {
        name: config.chainId === 31337 ? 'Hardhat Local EVM' : 'Ethereum L2 / Testnet',
        chainId: config.chainId,
        contractAddress: config.contractAddress,
        currentBlockNumber,
        isNodeOnline,
      },
      metrics: {
        totalRecords,
        confirmed: statusBreakdown['CONFIRMED'] || 0,
        pending: statusBreakdown['PENDING'] || 0,
        failed: statusBreakdown['FAILED'] || 0,
        anchorsByType: typeBreakdown,
      },
      recentAnchors: recentTransactions.map((tx) => ({
        id: tx.id,
        txHash: tx.blockchainTxHash,
        blockNumber: tx.blockNumber,
        recordType: tx.recordType,
        recordHash: tx.recordHash,
        status: tx.status,
        passportId: tx.vehicle?.passportId || null,
        vehicleLabel: tx.vehicle ? `${tx.vehicle.manufacturer} ${tx.vehicle.model}` : null,
        timestamp: tx.createdAt,
      })),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Searchable, paginated blockchain explorer records for admin
   */
  async getBlockchainRecords(options: {
    search?: string;
    recordType?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.recordType && options.recordType !== 'ALL') {
      where.recordType = options.recordType;
    }
    if (options.status && options.status !== 'ALL') {
      where.status = options.status;
    }
    if (options.search) {
      const q = options.search.trim();
      where.OR = [
        { blockchainTxHash: { contains: q, mode: 'insensitive' } },
        { recordHash: { contains: q, mode: 'insensitive' } },
        { vehicle: { passportId: { contains: q, mode: 'insensitive' } } },
        { vehicle: { vin: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, records] = await Promise.all([
      prisma.blockchainRecord.count({ where }),
      prisma.blockchainRecord.findMany({
        where,
        include: {
          vehicle: { select: { passportId: true, manufacturer: true, model: true, vin: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      records: records.map((r) => ({
        id: r.id,
        txHash: r.blockchainTxHash,
        blockNumber: r.blockNumber,
        recordType: r.recordType,
        recordHash: r.recordHash,
        status: r.status,
        network: r.blockchainNetwork,
        passportId: r.vehicle?.passportId || null,
        vehicleSummary: r.vehicle ? `${r.vehicle.manufacturer} ${r.vehicle.model} (${r.vehicle.vin})` : null,
        createdAt: r.createdAt,
      })),
    };
  }

  /**
   * Administrative Tamper / Anomaly Incident Monitor & Case Listing
   */
  async getTamperAndAnomalyIncidents() {
    // 1. Fetch existing AdminCase records
    const cases = await prisma.adminCase.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        vehicle: { select: { passportId: true, manufacturer: true, model: true, vin: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    // 2. Fetch recent audit logs with TAMPER_DETECTED or UNAUTHORIZED_ACCESS
    const recentAuditAlerts = await prisma.auditLog.findMany({
      where: {
        action: { in: ['TAMPER_DETECTED', 'UNAUTHORIZED_ACCESS'] },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        vehicle: { select: { passportId: true, manufacturer: true, model: true } },
        user: { select: { name: true, email: true, role: true } },
      },
    });

    return {
      cases: cases.map((c) => ({
        id: c.id,
        caseNumber: c.caseNumber,
        category: c.category,
        title: c.title,
        description: c.description,
        severity: c.severity,
        status: c.status,
        evidence: c.evidence ? JSON.parse(c.evidence) : null,
        vehicle: c.vehicle ? `${c.vehicle.manufacturer} ${c.vehicle.model} (${c.vehicle.passportId})` : null,
        vehiclePassportId: c.vehicle?.passportId || null,
        assignedTo: c.assignedTo?.name || 'Unassigned',
        resolutionNotes: c.resolutionNotes,
        resolvedAt: c.resolvedAt,
        resolvedBy: c.resolvedBy,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      recentAuditAlerts: recentAuditAlerts.map((a) => ({
        id: a.id,
        action: a.action,
        status: a.status,
        passportId: a.vehicle?.passportId || null,
        user: a.user?.name || 'Public / Guest',
        details: a.details,
        timestamp: a.createdAt,
      })),
    };
  }

  /**
   * Create an administrative case for an anomaly or verification failure
   */
  async createCase(adminUserId: string, input: AdminCaseInput) {
    const currentYear = new Date().getFullYear();
    let newCase: any;
    let attempts = 0;

    while (!newCase && attempts < 5) {
      attempts++;
      // Determine highest sequence number for this year to prevent race conditions
      const latestCase = await prisma.adminCase.findFirst({
        where: { caseNumber: { startsWith: `CASE-${currentYear}-` } },
        orderBy: { createdAt: 'desc' },
        select: { caseNumber: true },
      });

      let nextSeq = 1;
      if (latestCase?.caseNumber) {
        const parts = latestCase.caseNumber.split('-');
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) {
          nextSeq = parsed + attempts;
        } else {
          const count = await prisma.adminCase.count();
          nextSeq = count + attempts;
        }
      } else {
        const count = await prisma.adminCase.count();
        nextSeq = count + attempts;
      }

      const caseNumber = `CASE-${currentYear}-${String(nextSeq).padStart(4, '0')}`;

      try {
        newCase = await prisma.adminCase.create({
          data: {
            caseNumber,
            vehicleId: input.vehicleId || null,
            category: input.category,
            title: input.title.trim(),
            description: input.description.trim(),
            severity: input.severity || 'MEDIUM',
            evidence: input.evidence ? JSON.stringify(input.evidence) : null,
            status: 'OPEN',
          },
        });
      } catch (err: any) {
        if (err.code === 'P2002' && attempts < 5) {
          // Unique constraint violation (race condition) — retry next sequence
          continue;
        }
        throw err;
      }
    }

    await logAuditEvent({
      action: 'ADMIN_CASE_CREATED',
      userId: adminUserId,
      vehicleId: input.vehicleId || null,
      details: {
        caseNumber: newCase.caseNumber,
        category: newCase.category,
        severity: newCase.severity,
      },
    });

    return newCase;
  }

  /**
   * Update case resolution status, notes, or assigned administrator
   */
  async updateCase(adminUserId: string, caseId: string, input: AdminCaseUpdateInput) {
    const adminUser = await prisma.user.findUnique({
      where: { id: adminUserId },
      select: { name: true },
    });

    const updateData: any = {};
    if (input.status) {
      updateData.status = input.status;
      if (input.status === 'RESOLVED' || input.status === 'DISMISSED') {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = adminUser?.name || 'Admin';
      }
    }
    if (input.resolutionNotes !== undefined) {
      updateData.resolutionNotes = input.resolutionNotes;
    }
    if (input.assignedToId !== undefined) {
      updateData.assignedToId = input.assignedToId;
    }

    const updated = await prisma.adminCase.update({
      where: { id: caseId },
      data: updateData,
    });

    await logAuditEvent({
      action: 'ADMIN_CASE_UPDATED',
      userId: adminUserId,
      vehicleId: updated.vehicleId,
      details: {
        caseNumber: updated.caseNumber,
        status: updated.status,
        resolutionNotes: updated.resolutionNotes,
      },
    });

    return updated;
  }

  /**
   * Vehicle Data Quality Audits: Detect records with missing fields, gaps, or inconsistencies
   */
  async getDataQualityAudits() {
    const [vehiclesWithoutOdometer, vehiclesWithoutService, vehiclesWithoutInsurance, mismatchedDocs] =
      await Promise.all([
        prisma.vehicle.findMany({
          where: { odometerRecords: { none: {} } },
          select: { id: true, passportId: true, manufacturer: true, model: true, manufacturingYear: true },
        }),
        prisma.vehicle.findMany({
          where: { serviceRecords: { none: {} } },
          select: { id: true, passportId: true, manufacturer: true, model: true },
        }),
        prisma.vehicle.findMany({
          where: { insuranceRecords: { none: {} } },
          select: { id: true, passportId: true, manufacturer: true, model: true },
        }),
        prisma.vehicleDocument.findMany({
          where: { consistencyStatus: { in: ['INCONSISTENT', 'PARTIAL'] } },
          include: { vehicle: { select: { passportId: true, manufacturer: true, model: true } } },
        }),
      ]);

    return {
      summary: {
        missingOdometerCount: vehiclesWithoutOdometer.length,
        missingServiceCount: vehiclesWithoutService.length,
        missingInsuranceCount: vehiclesWithoutInsurance.length,
        documentMismatchesCount: mismatchedDocs.length,
      },
      vehiclesMissingOdometer: vehiclesWithoutOdometer,
      vehiclesMissingService: vehiclesWithoutService,
      vehiclesMissingInsurance: vehiclesWithoutInsurance,
      mismatchedDocuments: mismatchedDocs.map((d) => ({
        id: d.id,
        title: d.title,
        documentType: d.documentType,
        passportId: d.vehicle.passportId,
        vehicleLabel: `${d.vehicle.manufacturer} ${d.vehicle.model}`,
        consistencyStatus: d.consistencyStatus,
        createdAt: d.createdAt,
      })),
    };
  }

  /**
   * System Audit Logs viewer with filters and pagination
   */
  async getAuditLogs(options: {
    action?: string;
    status?: string;
    vehicleId?: string;
    userId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 25));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.action && options.action !== 'ALL') {
      where.action = options.action;
    }
    if (options.status && options.status !== 'ALL') {
      where.status = options.status;
    }
    if (options.vehicleId) {
      where.vehicleId = options.vehicleId;
    }
    if (options.userId) {
      where.userId = options.userId;
    }
    if (options.search) {
      const q = options.search.trim();
      where.OR = [
        { details: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
        { vehicle: { passportId: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          vehicle: { select: { passportId: true, manufacturer: true, model: true } },
          user: { select: { name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        status: l.status,
        actor: l.user ? `${l.user.name} (${l.user.role})` : 'System / Public',
        actorEmail: l.user?.email || null,
        passportId: l.vehicle?.passportId || null,
        vehicleLabel: l.vehicle ? `${l.vehicle.manufacturer} ${l.vehicle.model}` : null,
        details: l.details,
        createdAt: l.createdAt,
      })),
    };
  }

  /**
   * Unified Global Search across all entities
   */
  async globalSearch(query: string) {
    const q = query.trim();
    if (!q || q.length < 2) {
      return { vehicles: [], users: [], records: [], garages: [] };
    }

    const [vehicles, users, records, garages] = await Promise.all([
      prisma.vehicle.findMany({
        where: {
          OR: [
            { passportId: { contains: q, mode: 'insensitive' } },
            { vin: { contains: q, mode: 'insensitive' } },
            { registrationNumber: { contains: q, mode: 'insensitive' } },
            { model: { contains: q, mode: 'insensitive' } },
            { manufacturer: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 8,
        include: { currentOwner: { select: { name: true, email: true } } },
      }),
      prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 8,
        select: { id: true, name: true, email: true, role: true, isInitialized: true },
      }),
      prisma.blockchainRecord.findMany({
        where: {
          OR: [
            { blockchainTxHash: { contains: q, mode: 'insensitive' } },
            { recordHash: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 8,
        include: { vehicle: { select: { passportId: true } } },
      }),
      prisma.garageProfile.findMany({
        where: {
          OR: [
            { businessName: { contains: q, mode: 'insensitive' } },
            { specialties: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 8,
      }),
    ]);

    return {
      vehicles: vehicles.map((v) => ({
        id: v.id,
        passportId: v.passportId,
        vin: v.vin,
        manufacturer: v.manufacturer,
        model: v.model,
        owner: v.currentOwner?.name,
      })),
      users,
      blockchainRecords: records.map((r) => ({
        id: r.id,
        txHash: r.blockchainTxHash,
        recordType: r.recordType,
        status: r.status,
        passportId: r.vehicle?.passportId,
      })),
      garages: garages.map((g) => ({
        id: g.id,
        businessName: g.businessName,
        verificationStatus: g.verificationStatus,
        trustIndex: g.trustIndex,
      })),
    };
  }
}
