import { getAdminDb } from '@/lib/firebase/admin';

export type SecurityEventType =
  | 'UNAUTHORIZED_WRITE_ATTEMPT'
  | 'UNAUTHORIZED_MUTATION_ATTEMPT'
  | 'CROSS_USER_ACCESS_ATTEMPT'
  | 'AUTH_FAILURE'
  | 'SIGNATURE_MISMATCH'
  | 'INSUFFICIENT_FUNDS'
  | 'REPLAY_ATTEMPT'
  | 'PRIVILEGE_ESCALATION_ATTEMPT'
  | 'ADMIN_BLOCKCHAIN_RESET'
  | 'ADMIN_LEDGER_CONVERSION'
  | 'INVALID_PAYLOAD'
  | 'TRUSTED_BLOCK_COMMITTED'
  | 'WALLET_PROVISIONED'
  | 'ADMIN_ACCESS_DENIED'
  | 'SYSTEM_INTEGRITY_CHECK'
  | 'CHAIN_INTEGRITY_SCAN'
  | 'TAMPERED_BLOCK_DETECTED'
  | 'CHAIN_HASH_MISMATCH'
  | 'GENESIS_HASH_VERIFIED'
  | 'SMART_CONTRACT_COMMIT_FAILED'
  | 'SMART_CONTRACT_COMMIT_SUCCESS'
  | 'FRIEND_ADDED'
  | 'FRIEND_REMOVED';

export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SecurityEventRecord {
  eventId: string;
  type: SecurityEventType;
  userId?: string | null;
  resource: string;
  action: string;
  result: 'ALLOWED' | 'DENIED' | 'FLAGGED' | 'COMMITTED' | 'SUCCESS' | 'SUSPICIOUS';
  severity: SecuritySeverity;
  timestamp: string;
  requestId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Sanitizes metadata to strictly redact private keys, passwords, and bearer tokens.
 */
function sanitizeMetadata(data?: Record<string, any>): Record<string, any> {
  if (!data) return {};
  const cleaned: Record<string, any> = {};

  for (const [k, v] of Object.entries(data)) {
    const lowerKey = k.toLowerCase();
    if (
      lowerKey.includes('privatekey') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('password') ||
      lowerKey.includes('seed') ||
      lowerKey.includes('token') ||
      lowerKey.includes('bearer')
    ) {
      cleaned[k] = '[REDACTED_SECRET]';
    } else if (typeof v === 'object' && v !== null) {
      cleaned[k] = sanitizeMetadata(v);
    } else {
      cleaned[k] = v;
    }
  }

  return cleaned;
}

export class SecurityAuditLogger {
  private static COLLECTION = 'securityEvents';

  /**
   * Records a security event in the tamper-proof securityEvents collection.
   */
  public static async log(event: Omit<SecurityEventRecord, 'eventId' | 'timestamp'>): Promise<string> {
    const eventId = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const timestamp = new Date().toISOString();

    const record: SecurityEventRecord = {
      ...event,
      eventId,
      timestamp,
      metadata: sanitizeMetadata(event.metadata),
    };

    try {
      const adminDb = getAdminDb();
      await adminDb.collection(this.COLLECTION).doc(eventId).set(record);
      console.info(`[SecurityAudit] [${record.severity}] ${record.type} -> ${record.result} (${record.resource})`);
    } catch (err: any) {
      console.error('[SecurityAudit] Failed to persist security audit event:', err.message);
    }

    return eventId;
  }
}
