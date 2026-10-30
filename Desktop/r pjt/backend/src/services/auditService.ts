import { prisma } from '../lib/prisma';

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'USER_INITIALIZED'
  | 'VEHICLE_CREATED'
  | 'VEHICLE_UPDATED'
  | 'SERVICE_ADDED'
  | 'ODOMETER_ADDED'
  | 'ACCIDENT_ADDED'
  | 'INSURANCE_ADDED'
  | 'DOCUMENT_ADDED'
  | 'OWNERSHIP_TRANSFER_REQUESTED'
  | 'OWNERSHIP_TRANSFER_CONFIRMED'
  | 'OWNERSHIP_TRANSFER_FAILED'
  | 'BLOCKCHAIN_TRANSACTION_PENDING'
  | 'BLOCKCHAIN_TRANSACTION_CONFIRMED'
  | 'BLOCKCHAIN_TRANSACTION_FAILED'
  | 'VEHICLE_VERIFICATION'
  | 'TAMPER_DETECTED'
  | 'INTELLIGENCE_EVALUATED'
  | 'AI_INTELLIGENCE_QUERY'
  | 'DIGITAL_TWIN_RECONSTRUCTED'
  | 'BUYER_REPORT_GENERATED'
  | 'MANUFACTURER_CERTIFICATE_CREATED'
  | 'BATTERY_PASSPORT_CREATED'
  | 'BATTERY_EVENT_LOGGED'
  | 'INSURANCE_CLAIM_FILED'
  | 'GARAGE_PROFILE_UPDATED'
  | 'GARAGE_VERIFIED'
  | 'DISCLOSURE_CREATED'
  | 'DISCLOSURE_REVOKED'
  | 'DISCLOSURE_VIEWED'
  | 'ADMIN_CASE_CREATED'
  | 'ADMIN_CASE_UPDATED'
  | 'ADMIN_QUERY'
  | 'UNAUTHORIZED_ACCESS';

export type AuditStatus = 'SUCCESS' | 'FAILED' | 'WARNING';

export interface AuditLogInput {
  action: AuditAction;
  status?: AuditStatus;
  vehicleId?: string | null;
  userId?: string | null;
  details?: Record<string, any> | string | null;
}

/**
 * Sanitizes object by redacting sensitive keys like tokens, private keys, passwords.
 */
function sanitizeDetails(details: any): string | null {
  if (!details) return null;
  if (typeof details === 'string') {
    return details.slice(0, 1000);
  }

  const sensitiveKeys = ['password', 'privatekey', 'private_key', 'idtoken', 'token', 'secret', 'jwt'];
  const sanitized: Record<string, any> = {};

  for (const [key, val] of Object.entries(details)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = '[OBJECT]';
    } else {
      sanitized[key] = val;
    }
  }

  return JSON.stringify(sanitized).slice(0, 1000);
}

export async function logAuditEvent(input: AuditLogInput) {
  try {
    const sanitized = sanitizeDetails(input.details);
    return await prisma.auditLog.create({
      data: {
        action: input.action,
        status: input.status || 'SUCCESS',
        vehicleId: input.vehicleId || null,
        userId: input.userId || null,
        details: sanitized,
      },
    });
  } catch (error) {
    // Non-blocking: audit failure should not crash main application execution
    console.warn('[AUDIT LOG ERROR] Failed to record audit log:', error);
    return null;
  }
}
