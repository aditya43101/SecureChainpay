/**
 * SecureChain Pay — Data Classification System (Task 10)
 *
 * Classifies every data field into PUBLIC, INTERNAL, SENSITIVE, HIGHLY_SENSITIVE.
 * Used by AIDataGuard, audit logging, and privacy controls to enforce data minimization.
 */

export type ClassificationLevel = 'PUBLIC' | 'INTERNAL' | 'SENSITIVE' | 'HIGHLY_SENSITIVE';

export interface ClassifiedField {
  field: string;
  classification: ClassificationLevel;
  requiresTokenization: boolean;
  requiresRedaction: boolean;
  retentionCategory: 'OPERATIONAL' | 'ANALYTICS' | 'INTEGRITY' | 'SECURITY';
}

// ────────────────────────────────────────────────────────────
// Static classification registry
// ────────────────────────────────────────────────────────────

const FIELD_CLASSIFICATIONS: Record<string, Omit<ClassifiedField, 'field'>> = {
  // PUBLIC — safe to expose
  'transactionHash':       { classification: 'PUBLIC',           requiresTokenization: false, requiresRedaction: false, retentionCategory: 'INTEGRITY' },
  'blockNumber':           { classification: 'PUBLIC',           requiresTokenization: false, requiresRedaction: false, retentionCategory: 'INTEGRITY' },
  'networkName':           { classification: 'PUBLIC',           requiresTokenization: false, requiresRedaction: false, retentionCategory: 'OPERATIONAL' },
  'chainId':               { classification: 'PUBLIC',           requiresTokenization: false, requiresRedaction: false, retentionCategory: 'OPERATIONAL' },
  'status':                { classification: 'PUBLIC',           requiresTokenization: false, requiresRedaction: false, retentionCategory: 'OPERATIONAL' },
  'currency':              { classification: 'PUBLIC',           requiresTokenization: false, requiresRedaction: false, retentionCategory: 'OPERATIONAL' },

  // INTERNAL — operational, not user-facing
  'provider':              { classification: 'INTERNAL',         requiresTokenization: false, requiresRedaction: false, retentionCategory: 'OPERATIONAL' },
  'routingDecision':       { classification: 'INTERNAL',         requiresTokenization: false, requiresRedaction: false, retentionCategory: 'OPERATIONAL' },
  'nodeId':                { classification: 'INTERNAL',         requiresTokenization: false, requiresRedaction: false, retentionCategory: 'OPERATIONAL' },
  'latencyMs':             { classification: 'INTERNAL',         requiresTokenization: false, requiresRedaction: false, retentionCategory: 'OPERATIONAL' },
  'errorRate':             { classification: 'INTERNAL',         requiresTokenization: false, requiresRedaction: false, retentionCategory: 'OPERATIONAL' },
  'riskScore':             { classification: 'INTERNAL',         requiresTokenization: false, requiresRedaction: false, retentionCategory: 'SECURITY' },
  'modelVersion':          { classification: 'INTERNAL',         requiresTokenization: false, requiresRedaction: false, retentionCategory: 'SECURITY' },

  // SENSITIVE — needs tokenization in AI contexts
  'userId':                { classification: 'SENSITIVE',        requiresTokenization: true,  requiresRedaction: false, retentionCategory: 'SECURITY' },
  'walletAddress':         { classification: 'SENSITIVE',        requiresTokenization: true,  requiresRedaction: false, retentionCategory: 'SECURITY' },
  'senderAddress':         { classification: 'SENSITIVE',        requiresTokenization: true,  requiresRedaction: false, retentionCategory: 'SECURITY' },
  'receiverAddress':       { classification: 'SENSITIVE',        requiresTokenization: true,  requiresRedaction: false, retentionCategory: 'SECURITY' },
  'paymentIntentId':       { classification: 'SENSITIVE',        requiresTokenization: true,  requiresRedaction: false, retentionCategory: 'INTEGRITY' },
  'amount':                { classification: 'SENSITIVE',        requiresTokenization: false, requiresRedaction: false, retentionCategory: 'INTEGRITY' },
  'email':                 { classification: 'SENSITIVE',        requiresTokenization: true,  requiresRedaction: false, retentionCategory: 'SECURITY' },
  'phone':                 { classification: 'SENSITIVE',        requiresTokenization: true,  requiresRedaction: false, retentionCategory: 'SECURITY' },
  'ipAddress':             { classification: 'SENSITIVE',        requiresTokenization: true,  requiresRedaction: false, retentionCategory: 'SECURITY' },

  // HIGHLY SENSITIVE — must be redacted before AI, never logged
  'privateKey':            { classification: 'HIGHLY_SENSITIVE', requiresTokenization: false, requiresRedaction: true,  retentionCategory: 'SECURITY' },
  'seedPhrase':            { classification: 'HIGHLY_SENSITIVE', requiresTokenization: false, requiresRedaction: true,  retentionCategory: 'SECURITY' },
  'mnemonic':              { classification: 'HIGHLY_SENSITIVE', requiresTokenization: false, requiresRedaction: true,  retentionCategory: 'SECURITY' },
  'password':              { classification: 'HIGHLY_SENSITIVE', requiresTokenization: false, requiresRedaction: true,  retentionCategory: 'SECURITY' },
  'otp':                   { classification: 'HIGHLY_SENSITIVE', requiresTokenization: false, requiresRedaction: true,  retentionCategory: 'SECURITY' },
  'apiSecret':             { classification: 'HIGHLY_SENSITIVE', requiresTokenization: false, requiresRedaction: true,  retentionCategory: 'SECURITY' },
  'encryptionKey':         { classification: 'HIGHLY_SENSITIVE', requiresTokenization: false, requiresRedaction: true,  retentionCategory: 'SECURITY' },
  'sessionToken':          { classification: 'HIGHLY_SENSITIVE', requiresTokenization: false, requiresRedaction: true,  retentionCategory: 'SECURITY' },
  'databaseCredential':    { classification: 'HIGHLY_SENSITIVE', requiresTokenization: false, requiresRedaction: true,  retentionCategory: 'SECURITY' },
  'encryptedPrivateKey':   { classification: 'HIGHLY_SENSITIVE', requiresTokenization: false, requiresRedaction: true,  retentionCategory: 'SECURITY' },
};

// ────────────────────────────────────────────────────────────
// Classification API
// ────────────────────────────────────────────────────────────

export class DataClassifier {
  /** Classify a single field name. */
  static classify(fieldName: string): ClassifiedField {
    const normalized = fieldName.replace(/[-_]/g, '').toLowerCase();

    for (const [key, val] of Object.entries(FIELD_CLASSIFICATIONS)) {
      if (key.toLowerCase() === normalized) {
        return { field: fieldName, ...val };
      }
    }

    // Heuristic: anything with "key", "secret", "password", "seed" → HIGHLY_SENSITIVE
    if (/private.?key|secret|password|seed.?phrase|mnemonic|otp|credential/i.test(fieldName)) {
      return { field: fieldName, classification: 'HIGHLY_SENSITIVE', requiresTokenization: false, requiresRedaction: true, retentionCategory: 'SECURITY' };
    }

    if (/address|userid|email|phone|sender|receiver|recipient/i.test(fieldName)) {
      return { field: fieldName, classification: 'SENSITIVE', requiresTokenization: true, requiresRedaction: false, retentionCategory: 'SECURITY' };
    }

    return { field: fieldName, classification: 'INTERNAL', requiresTokenization: false, requiresRedaction: false, retentionCategory: 'OPERATIONAL' };
  }

  /** Classify all keys in an object. */
  static classifyObject(obj: Record<string, unknown>): Map<string, ClassifiedField> {
    const result = new Map<string, ClassifiedField>();
    for (const key of Object.keys(obj)) { result.set(key, this.classify(key)); }
    return result;
  }

  /** Get the highest sensitivity level in an object. */
  static getMaxClassification(obj: Record<string, unknown>): ClassificationLevel {
    const order: ClassificationLevel[] = ['PUBLIC', 'INTERNAL', 'SENSITIVE', 'HIGHLY_SENSITIVE'];
    let maxIdx = 0;
    for (const key of Object.keys(obj)) {
      const idx = order.indexOf(this.classify(key).classification);
      if (idx > maxIdx) maxIdx = idx;
    }
    return order[maxIdx];
  }

  /** Filter an object to only include fields at or below a given level. */
  static filterByMaxLevel(obj: Record<string, unknown>, maxLevel: ClassificationLevel): Record<string, unknown> {
    const order: ClassificationLevel[] = ['PUBLIC', 'INTERNAL', 'SENSITIVE', 'HIGHLY_SENSITIVE'];
    const maxIdx = order.indexOf(maxLevel);
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (order.indexOf(this.classify(key).classification) <= maxIdx) result[key] = value;
    }
    return result;
  }

  /** Fields that require redaction before AI processing. */
  static getRedactableFields(obj: Record<string, unknown>): string[] {
    return Object.keys(obj).filter(key => this.classify(key).requiresRedaction);
  }

  /** Fields that should be tokenized for AI contexts. */
  static getTokenizableFields(obj: Record<string, unknown>): string[] {
    return Object.keys(obj).filter(key => this.classify(key).requiresTokenization);
  }
}
