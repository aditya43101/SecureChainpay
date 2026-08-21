import { ethers } from 'ethers';
import { decryptPrivateKey } from '@/lib/crypto/client-aes';

const getClientSecret = (uid: string) => `securechain_client_${uid}_secret`;

export interface WalletKeyAccessInput {
  uid: string;
  encryptedPrivateKey: string;
  address: string;
  publicKey: string;
}

/**
 * The single on-demand private-key access path. The decrypted key is kept only
 * in the returned in-memory signer and is never persisted or logged.
 */
export async function getWalletSigner(input: WalletKeyAccessInput): Promise<ethers.Wallet> {
  const currentUid = input.uid;
  if (!currentUid || !input.encryptedPrivateKey || !input.address || !input.publicKey) {
    throw new Error('Wallet key access requires a complete authenticated wallet identity.');
  }

  const privateKey = await decryptPrivateKey(input.encryptedPrivateKey, getClientSecret(currentUid));
  const signer = new ethers.Wallet(privateKey);
  if (
    signer.address.toLowerCase() !== input.address.toLowerCase() ||
    signer.signingKey.publicKey !== input.publicKey
  ) {
    throw new Error('Wallet integrity verification failed. Stored wallet identity does not match the encrypted key.');
  }
  return signer;
}
