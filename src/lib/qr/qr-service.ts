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

  // 1. Structured URI format: securechainpay://pay?... or securechainpay://...
  if (trimmed.startsWith(SECURECHAIN_SCHEME) || trimmed.startsWith('securechainpay://')) {
    try {
      const urlStr = trimmed.replace('securechainpay://pay', 'https://securechainpay.internal/pay').replace('securechainpay://', 'https://securechainpay.internal/');
      const url = new URL(urlStr);
      const address = url.searchParams.get('address') || url.searchParams.get('wallet') || url.searchParams.get('to') || '';
      const uid = url.searchParams.get('uid') || undefined;
      const username = url.searchParams.get('username') || undefined;
      const displayName = url.searchParams.get('displayName') || url.searchParams.get('name') || undefined;
      const amountStr = url.searchParams.get('amount') || url.searchParams.get('value');
      const amount = amountStr ? Number(amountStr) : undefined;
      const currency = url.searchParams.get('currency') || 'HSCT';

      const hexMatch = address.match(/0x[a-fA-F0-9]{40}/i) || trimmed.match(/0x[a-fA-F0-9]{40}/i);
      const resolvedAddress = hexMatch ? hexMatch[0] : address;

      if (!resolvedAddress || !resolvedAddress.startsWith('0x') || resolvedAddress.length < 10) {
        return { isValid: false, payload: null, error: 'QR URI contains an invalid wallet address.' };
      }

      return {
        isValid: true,
        payload: {
          address: resolvedAddress,
          uid,
          username,
          displayName,
          amount,
          currency,
        },
      };
    } catch (err) {
      // Fall through
    }
  }

  // 2. JSON object format: {"address": "0x...", ...}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const json = JSON.parse(trimmed);
      const address = json.address || json.walletAddress || json.wallet || json.to;
      const hexMatch = typeof address === 'string' ? (address.match(/0x[a-fA-F0-9]{40}/i) || [address])[0] : null;
      if (hexMatch && hexMatch.startsWith('0x') && hexMatch.length >= 10) {
        return {
          isValid: true,
          payload: {
            address: hexMatch,
            uid: json.uid || json.userId,
            username: json.username,
            displayName: json.displayName || json.name,
            amount: json.amount ? Number(json.amount) : undefined,
            currency: json.currency || 'HSCT',
          },
        };
      }
    } catch (err) {
      // Fallthrough to next checks
    }
  }

  // 3. Ethereum URI (e.g. ethereum:0x1234...?value=1) or Web URL
  if (trimmed.toLowerCase().startsWith('ethereum:') || trimmed.toLowerCase().startsWith('web3:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const hexMatch = trimmed.match(/0x[a-fA-F0-9]{40}/i);
      if (hexMatch) {
        let amount: number | undefined;
        let currency: string | undefined = 'HSCT';
        let username: string | undefined;
        let displayName: string | undefined;

        if (trimmed.includes('?')) {
          const params = new URLSearchParams(trimmed.split('?')[1]);
          if (params.get('amount')) amount = Number(params.get('amount'));
          if (params.get('value')) amount = Number(params.get('value'));
          if (params.get('currency')) currency = params.get('currency') || 'HSCT';
          if (params.get('username')) username = params.get('username') || undefined;
          if (params.get('displayName')) displayName = params.get('displayName') || undefined;
        }

        return {
          isValid: true,
          payload: {
            address: hexMatch[0],
            amount,
            currency,
            username,
            displayName,
          },
        };
      }
    } catch (err) {
      // Fallthrough
    }
  }

  // 4. Raw Ethereum 0x Wallet Address format
  const rawAddressMatch = trimmed.match(/0x[a-fA-F0-9]{40}/i);
  if (rawAddressMatch) {
    return {
      isValid: true,
      payload: {
        address: rawAddressMatch[0],
        currency: 'HSCT',
      },
    };
  }

  if (trimmed.startsWith('0x') && trimmed.length >= 10) {
    return {
      isValid: true,
      payload: {
        address: trimmed,
        currency: 'HSCT',
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
