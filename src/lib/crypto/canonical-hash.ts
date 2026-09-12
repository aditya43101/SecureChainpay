import crypto from 'crypto';

/**
 * Deterministically sorts object keys recursively to produce canonical JSON.
 * Prevents hash discrepancies caused by varying key order.
 */
export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }

  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJsonStringify(obj[key])}`
  );
  return '{' + pairs.join(',') + '}';
}

/**
 * Universal SHA-256 hashing utility.
 * Returns lowercase hex string prefixed with '0x'.
 */
export async function sha256Hex(content: string): Promise<string> {
  // If running in Node.js server environment:
  if (typeof process !== 'undefined' && process.versions?.node) {
    const hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    return '0x' + hash;
  }

  // If running in modern browser:
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const msgBuffer = new TextEncoder().encode(content);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return '0x' + hashHex;
  }

  // Fallback
  const hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  return '0x' + hash;
}

/**
 * Synchronous version for server-side processing
 */
export function sha256HexSync(content: string): string {
  const hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  return '0x' + hash;
}

export interface CanonicalBlockPayloadInput {
  blockNumber: number;
  previousHash: string;
  sender: string;
  receiver: string;
  amount: number;
  currency: string;
  date: string;
  type: string;
  idempotencyKey?: string;
}

/**
 * Constructs the canonical deterministic block payload string.
 */
export function buildCanonicalBlockPayload(input: CanonicalBlockPayloadInput): string {
  return [
    `block:${input.blockNumber}`,
    `prev:${input.previousHash}`,
    `sender:${(input.sender || '').toLowerCase().trim()}`,
    `receiver:${(input.receiver || '').toLowerCase().trim()}`,
    `amount:${Number(input.amount).toFixed(6)}`,
    `currency:${(input.currency || 'HSCT').toUpperCase().trim()}`,
    `date:${input.date}`,
    `type:${input.type}`,
    `nonce:${input.idempotencyKey || ''}`,
  ].join('|');
}

/**
 * Calculates the authoritative canonical block hash.
 */
export async function calculateCanonicalBlockHash(input: CanonicalBlockPayloadInput): Promise<string> {
  const payload = buildCanonicalBlockPayload(input);
  return sha256Hex(payload);
}
