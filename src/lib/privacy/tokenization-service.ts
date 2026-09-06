/**
 * SecureChain Pay — Tokenization Service (Task 10)
 *
 * Replaces sensitive identifiers with deterministic pseudonymous tokens.
 * Wallet addresses → WLT_XXXX, User IDs → USR_XXXX, Payment IDs → PAY_XXXX.
 * Uses HMAC-SHA256 with a server secret for deterministic but irreversible tokens.
 */

import crypto from 'crypto';

export type TokenType = 'USR' | 'WLT' | 'PAY' | 'TXN' | 'ADR' | 'EML';

// In-memory reverse mapping (admin-only detokenization)
const tokenMap = new Map<string, { type: TokenType; original: string; createdAt: number }>();

// TTL for token cache (24 hours)
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function getSecret(): string {
  return process.env.TOKENIZATION_SECRET || process.env.NEXTAUTH_SECRET || 'sc-pay-default-token-secret-replace-in-prod';
}

export class TokenizationService {
  /**
   * Generate a deterministic pseudonymous token for a value.
   * Same (type, value) always produces the same token.
   */
  static tokenize(type: TokenType, rawValue: string): string {
    if (!rawValue) return `${type}_UNKNOWN`;

    const hmac = crypto.createHmac('sha256', getSecret());
    hmac.update(`${type}:${rawValue}`);
    const hash = hmac.digest('hex').substring(0, 8).toUpperCase();
    const token = `${type}_${hash}`;

    // Store reverse mapping for admin detokenization
    if (!tokenMap.has(token)) {
      tokenMap.set(token, { type, original: rawValue, createdAt: Date.now() });
    }

    return token;
  }

  /**
   * Batch tokenize multiple values.
   */
  static tokenizeBatch(entries: Array<{ type: TokenType; value: string }>): Map<string, string> {
    const result = new Map<string, string>();
    for (const { type, value } of entries) {
      result.set(value, this.tokenize(type, value));
    }
    return result;
  }

  /**
   * Detokenize a token back to the original value.
   * Admin-only operation — access must be verified by the caller.
   */
  static detokenize(token: string): string | null {
    const entry = tokenMap.get(token);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.createdAt > TOKEN_TTL_MS) {
      tokenMap.delete(token);
      return null;
    }

    return entry.original;
  }

  /**
   * Tokenize all sensitive identifiers in a text string.
   * Replaces wallet addresses (0x...), UUIDs, email addresses.
   */
  static tokenizeText(text: string): string {
    let result = text;

    // Ethereum-style addresses: 0x followed by 40 hex chars
    result = result.replace(/0x[a-fA-F0-9]{40}/g, (match) => this.tokenize('WLT', match));

    // UUIDs
    result = result.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, (match) => this.tokenize('PAY', match));

    // Email addresses
    result = result.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, (match) => this.tokenize('EML', match));

    return result;
  }

  /**
   * Tokenize specific fields in an object, returning a new sanitized object.
   */
  static tokenizeObject(obj: Record<string, unknown>, fieldsToTokenize: string[]): Record<string, unknown> {
    const result = { ...obj };
    for (const field of fieldsToTokenize) {
      if (result[field] && typeof result[field] === 'string') {
        const type = this.inferTokenType(field);
        result[field] = this.tokenize(type, result[field] as string);
      }
    }
    return result;
  }

  /**
   * Infer the token type from a field name.
   */
  private static inferTokenType(fieldName: string): TokenType {
    const lower = fieldName.toLowerCase();
    if (lower.includes('user') || lower.includes('actor') || lower.includes('uid')) return 'USR';
    if (lower.includes('wallet') || lower.includes('address') || lower.includes('sender') || lower.includes('receiver') || lower.includes('recipient')) return 'WLT';
    if (lower.includes('payment') || lower.includes('intent')) return 'PAY';
    if (lower.includes('transaction') || lower.includes('txhash')) return 'TXN';
    if (lower.includes('email')) return 'EML';
    return 'PAY'; // Default
  }

  /**
   * Periodically clean expired tokens from the in-memory cache.
   */
  static cleanExpiredTokens(): number {
    let cleaned = 0;
    const now = Date.now();
    for (const [token, entry] of tokenMap.entries()) {
      if (now - entry.createdAt > TOKEN_TTL_MS) {
        tokenMap.delete(token);
        cleaned++;
      }
    }
    return cleaned;
  }

  /** Get stats about the token cache. */
  static getStats() {
    return { totalTokens: tokenMap.size, ttlMs: TOKEN_TTL_MS };
  }
}
