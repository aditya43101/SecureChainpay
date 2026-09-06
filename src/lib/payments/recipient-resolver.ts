import { parseQRPayload, QRPayload } from '@/lib/qr/qr-service';

export type RecipientType = 'INTERNAL_USER' | 'EXTERNAL_WALLET';

export interface ResolvedRecipient {
  recipientType: RecipientType;
  uid?: string;
  username?: string;
  displayName?: string;
  walletAddress: string;
  avatarUrl?: string | null;
  amount?: number;
  currency?: string;
}

/**
 * Validates and abbreviates Ethereum/SecureChain wallet addresses.
 * Example: 0x82F31A78B091... -> 0x82F3...A78B
 */
export function abbreviateAddress(address: string, startLen: number = 6, endLen: number = 4): string {
  if (!address || typeof address !== 'string') return '';
  if (address.length <= startLen + endLen) return address;
  return `${address.substring(0, startLen)}...${address.substring(address.length - endLen)}`;
}

/**
 * Standardizes recipient resolution from any raw input or search item.
 */
export function resolveRecipientFromPayload(
  input: QRPayload | { uid?: string; username?: string; displayName?: string; walletAddress?: string; address?: string; amount?: number; currency?: string }
): ResolvedRecipient {
  const walletAddress = ('address' in input ? input.address : (input as any).walletAddress || '').trim();
  const uid = input.uid;
  const username = input.username;
  const displayName = input.displayName;
  const amount = input.amount;
  const currency = input.currency;

  if (uid || username) {
    return {
      recipientType: 'INTERNAL_USER',
      uid,
      username: username ? (username.startsWith('@') ? username : `@${username}`) : undefined,
      displayName: displayName || username || 'SecureChain User',
      walletAddress,
      amount,
      currency,
    };
  }

  return {
    recipientType: 'EXTERNAL_WALLET',
    walletAddress,
    displayName: abbreviateAddress(walletAddress),
    amount,
    currency,
  };
}

/**
 * Resolves a QR code string payload into a validated ResolvedRecipient object.
 */
export function resolveRecipientFromQR(qrString: string): { success: boolean; recipient: ResolvedRecipient | null; error?: string } {
  const parsed = parseQRPayload(qrString);
  if (!parsed.isValid || !parsed.payload) {
    return { success: false, recipient: null, error: parsed.error || 'Invalid QR code.' };
  }

  const recipient = resolveRecipientFromPayload(parsed.payload);
  return { success: true, recipient };
}
