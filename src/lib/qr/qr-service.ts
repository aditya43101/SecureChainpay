import QRCode from 'qrcode';

export interface QRPayload {
  address: string;
  uid?: string;
  username?: string;
  displayName?: string;
  amount?: number;
  currency?: string;
}

const SECURECHAIN_SCHEME = 'securechainpay://pay';

/**
 * Builds a structured SecureChain Pay payment URI string.
 * Example: securechainpay://pay?address=0x123...&uid=xyz&username=rahul&displayName=Rahul%20Sharma
 */
export function buildQRPayloadURI(data: QRPayload): string {
  const params = new URLSearchParams();
  if (data.address) params.set('address', data.address);
  if (data.uid) params.set('uid', data.uid);
  if (data.username) params.set('username', data.username);
  if (data.displayName) params.set('displayName', data.displayName);
  if (data.amount && data.amount > 0) params.set('amount', data.amount.toString());
  if (data.currency) params.set('currency', data.currency);

  return `${SECURECHAIN_SCHEME}?${params.toString()}`;
}

/**
 * Safely parses any QR code text payload into a structured QRPayload object.
 * Supports:
 * 1. securechainpay://pay?address=0x...&username=...
 * 2. JSON object string {"address": "0x...", "username": "..."}
 * 3. Raw Ethereum 0x wallet address (42 chars or 0x prefix)
 */
export function parseQRPayload(rawText: string): { isValid: boolean; payload: QRPayload | null; error?: string } {
  if (!rawText || typeof rawText !== 'string') {
    return { isValid: false, payload: null, error: 'Empty or invalid QR payload' };
  }

  const trimmed = rawText.trim();

  // 1. Structured URI format: securechainpay://pay?...
  if (trimmed.startsWith(SECURECHAIN_SCHEME) || trimmed.startsWith('securechainpay://')) {
    try {
      const urlStr = trimmed.replace('securechainpay://pay', 'https://securechainpay.internal/pay');
      const url = new URL(urlStr);
      const address = url.searchParams.get('address') || '';
      const uid = url.searchParams.get('uid') || undefined;
      const username = url.searchParams.get('username') || undefined;
      const displayName = url.searchParams.get('displayName') || undefined;
      const amountStr = url.searchParams.get('amount');
      const amount = amountStr ? Number(amountStr) : undefined;
      const currency = url.searchParams.get('currency') || undefined;

      if (!address || !address.startsWith('0x') || address.length < 10) {
        return { isValid: false, payload: null, error: 'QR URI contains an invalid wallet address.' };
      }

      return {
        isValid: true,
        payload: {
          address,
          uid,
          username,
          displayName,
          amount,
          currency,
        },
      };
    } catch (err) {
      return { isValid: false, payload: null, error: 'Malformed SecureChain Pay QR URI.' };
    }
  }

  // 2. JSON object format: {"address": "0x...", ...}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const json = JSON.parse(trimmed);
      const address = json.address || json.walletAddress || json.wallet;
      if (address && typeof address === 'string' && address.startsWith('0x') && address.length >= 10) {
        return {
          isValid: true,
          payload: {
            address,
            uid: json.uid || json.userId,
            username: json.username,
            displayName: json.displayName || json.name,
            amount: json.amount ? Number(json.amount) : undefined,
            currency: json.currency,
          },
        };
      }
    } catch (err) {
      // Fallthrough to next checks
    }
  }

  // 3. Raw Ethereum 0x Wallet Address format
  const rawAddressMatch = trimmed.match(/0x[a-fA-F0-9]{40}/);
  if (rawAddressMatch) {
    return {
      isValid: true,
      payload: {
        address: rawAddressMatch[0],
      },
    };
  }

  if (trimmed.startsWith('0x') && trimmed.length >= 10) {
    return {
      isValid: true,
      payload: {
        address: trimmed,
      },
    };
  }

  return {
    isValid: false,
    payload: null,
    error: 'Unrecognized QR code format. Please scan a valid SecureChain Pay or Wallet QR code.',
  };
}

/**
 * Generates a high-quality PNG Data URL from QR payload data.
 */
export async function generateQRDataURL(data: QRPayload | string, size: number = 300): Promise<string> {
  const textToEncode = typeof data === 'string' ? data : buildQRPayloadURI(data);
  return QRCode.toDataURL(textToEncode, {
    width: size,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H',
  });
}
