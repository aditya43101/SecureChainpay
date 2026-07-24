import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;

/**
 * Encrypts a text using AES-256-GCM
 * @param text The text to encrypt
 * @param secret The encryption password/secret
 * @returns The encrypted string (base64 encoded)
 */
export function encrypt(text: string, secret: string = process.env.ENCRYPTION_KEY || 'fallback-secret-key-123456789012'): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.scryptSync(secret, salt, 32);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypts a text using AES-256-GCM
 * @param encryptedText The encrypted text (base64 encoded)
 * @param secret The encryption password/secret
 * @returns The decrypted text
 */
export function decrypt(encryptedText: string, secret: string = process.env.ENCRYPTION_KEY || 'fallback-secret-key-123456789012'): string {
  const buffer = Buffer.from(encryptedText, 'base64');

  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, TAG_POSITION);
  const tag = buffer.subarray(TAG_POSITION, TAG_POSITION + TAG_LENGTH);
  const encrypted = buffer.subarray(TAG_POSITION + TAG_LENGTH);

  const key = crypto.scryptSync(secret, salt, 32);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
