import { prisma } from '../lib/prisma';

export interface SystemAlert {
  id: string;
  type: 'ODOMETER_ROLLBACK' | 'TAMPER_DETECTED' | 'BLOCKCHAIN_FAILURE' | 'UNAUTHORIZED_ACCESS';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  timestamp: string;
  vehicleId?: string | null;
  passportId?: string | null;
  metadata?: any;
}

export async function getSystemAlerts(vehicleId?: string): Promise<SystemAlert[]> {
  const alerts: SystemAlert[] = [];

  // 1. Odometer rollbacks
  const rollbackRecords = await prisma.odometerRecord.findMany({
    where: {
      rollbackDetected: true,
      ...(vehicleId ? { vehicleId } : {}),
    },
    include: {
      vehicle: { select: { id: true, passportId: true, manufacturer: true, model: true } },
    },
    orderBy: { recordedAt: 'desc' },
    take: 20,
  });

  for (const rec of rollbackRecords) {
    alerts.push({
      id: `alert-rollback-${rec.id}`,
      type: 'ODOMETER_ROLLBACK',
      severity: 'CRITICAL',
      title: 'Odometer Rollback Warning',
      message: `Detected suspicious lower mileage (${rec.mileage.toLocaleString()} km) on vehicle ${rec.vehicle.passportId} (${rec.vehicle.manufacturer} ${rec.vehicle.model}).`,
      timestamp: rec.recordedAt.toISOString(),
      vehicleId: rec.vehicle.id,
      passportId: rec.vehicle.passportId,
      metadata: { mileage: rec.mileage, recordId: rec.id },
    });
  }

  // 2. Tamper events recorded in AuditLog
  const tamperLogs = await prisma.auditLog.findMany({
    where: {
      action: 'TAMPER_DETECTED',
      ...(vehicleId ? { vehicleId } : {}),
    },
    include: {
      vehicle: { select: { id: true, passportId: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  for (const log of tamperLogs) {
    alerts.push({
      id: `alert-tamper-${log.id}`,
      type: 'TAMPER_DETECTED',
      severity: 'CRITICAL',
      title: 'Cryptographic Hash Tamper Detected',
      message: `Database record hash does not match immutable blockchain anchor for ${log.vehicle?.passportId || 'vehicle'}.`,
      timestamp: log.createdAt.toISOString(),
      vehicleId: log.vehicleId,
      passportId: log.vehicle?.passportId,
      metadata: log.details ? JSON.parse(log.details) : undefined,
    });
  }

  // 3. Failed blockchain transactions
  const failedTxLogs = await prisma.auditLog.findMany({
    where: {
      action: { in: ['BLOCKCHAIN_TRANSACTION_FAILED', 'OWNERSHIP_TRANSFER_FAILED'] },
      ...(vehicleId ? { vehicleId } : {}),
    },
    include: {
      vehicle: { select: { id: true, passportId: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  for (const log of failedTxLogs) {
    alerts.push({
      id: `alert-tx-${log.id}`,
      type: 'BLOCKCHAIN_FAILURE',
      severity: 'WARNING',
      title: 'Blockchain Operation Failed',
      message: `Transaction could not be confirmed on blockchain for ${log.vehicle?.passportId || 'vehicle'}.`,
      timestamp: log.createdAt.toISOString(),
      vehicleId: log.vehicleId,
      passportId: log.vehicle?.passportId,
      metadata: log.details ? JSON.parse(log.details) : undefined,
    });
  }

  return alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
