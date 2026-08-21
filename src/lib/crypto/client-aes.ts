export async function getEncryptionKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('securechain-static-salt-2024'), // Static salt for simple local derivation
      iterations: 10000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function getEncryptionKeyV2(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: 310000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPrivateKey(privateKey: string, secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await getEncryptionKeyV2(secret, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(privateKey);
  
  const cipherText = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedText
  );
  
  // Versioned format: SC2 + salt + IV + ciphertext/authentication tag.
  const combined = new Uint8Array(salt.length + iv.length + cipherText.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(cipherText), salt.length + iv.length);
  
  return `SC2:${btoa(String.fromCharCode(...combined))}`;
}

export async function decryptPrivateKey(encryptedText: string, secret: string): Promise<string> {
  if (encryptedText.startsWith('SC2:')) {
    const combined = new Uint8Array(
      atob(encryptedText.slice(4)).split('').map(char => char.charCodeAt(0))
    );
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const cipherText = combined.slice(28);
    const key = await getEncryptionKeyV2(secret, salt);
    const decryptedText = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherText);
    return new TextDecoder().decode(decryptedText);
  }

  // Legacy compatibility: existing wallets use the original static-salt format.
  // Callers must verify the derived wallet identity before accepting this value.
  const key = await getEncryptionKey(secret);
  const combined = new Uint8Array(
    atob(encryptedText)
      .split('')
      .map(char => char.charCodeAt(0))
  );
  
  const iv = combined.slice(0, 12);
  const cipherText = combined.slice(12);
  
  const decryptedText = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherText
  );
  
  return new TextDecoder().decode(decryptedText);
}
