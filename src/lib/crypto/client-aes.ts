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
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPrivateKey(privateKey: string, secret: string): Promise<string> {
  const key = await getEncryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(privateKey);
  
  const cipherText = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedText
  );
  
  // Combine IV and cipherText, then encode to base64
  const combined = new Uint8Array(iv.length + cipherText.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherText), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

export async function decryptPrivateKey(encryptedText: string, secret: string): Promise<string> {
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
