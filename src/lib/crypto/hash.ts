import crypto from 'crypto';
import bcrypt from 'bcrypt';
import * as argon2 from 'argon2';

const BCRYPT_SALT_ROUNDS = 12;

export async function hashPasswordBcrypt(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

export async function verifyPasswordBcrypt(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function hashPasswordArgon2(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyPasswordArgon2(password: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function hashSha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
