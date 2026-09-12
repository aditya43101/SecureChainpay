/**
 * Central Currency Conversion & Formatting Service
 * 
 * SecureChain Pay Canonical Currency Architecture:
 * - HSCT (High-Security Chain Token) is the native platform currency.
 * - 1 HSCT = 1 INR (Indian Rupee Parity).
 * - Standard FX Rate: 1 USD = 83.50 HSCT (1 HSCT ≈ $0.011976 USD).
 * - USD/INR are derived display currencies.
 */

export const DEFAULT_USD_HSCT_RATE = 83.50; // 1 USD = 83.50 HSCT

export interface StructuredAmount {
  hsctAmount: number;
  usdEquivalent: number;
  inrEquivalent: number;
  currency: 'HSCT';
  formattedHsct: string;
  formattedUsd: string;
  formattedInr: string;
}

/**
 * Converts HSCT amount to USD equivalent.
 */
export function convertHsctToUsd(hsctAmount: number, usdRate: number = DEFAULT_USD_HSCT_RATE): number {
  if (isNaN(hsctAmount) || hsctAmount === null || hsctAmount === undefined) return 0;
  return Number((hsctAmount / usdRate).toFixed(4));
}

/**
 * Converts USD amount to HSCT.
 */
export function convertUsdToHsct(usdAmount: number, usdRate: number = DEFAULT_USD_HSCT_RATE): number {
  if (isNaN(usdAmount) || usdAmount === null || usdAmount === undefined) return 0;
  return Number((usdAmount * usdRate).toFixed(2));
}

/**
 * Converts HSCT to INR (1 HSCT = 1 INR).
 */
export function convertHsctToInr(hsctAmount: number): number {
  if (isNaN(hsctAmount) || hsctAmount === null || hsctAmount === undefined) return 0;
  return Number(hsctAmount.toFixed(2));
}

/**
 * Formats a currency amount with clear explicit symbol/unit.
 */
export function formatCurrency(
  amount: number,
  currency: 'HSCT' | 'USD' | 'INR' = 'HSCT',
  options?: { showSymbol?: boolean; decimals?: number }
): string {
  const num = isNaN(amount) ? 0 : amount;
  const decimals = options?.decimals ?? (currency === 'HSCT' || currency === 'INR' ? 2 : 2);
  const formattedNum = num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (options?.showSymbol === false) return formattedNum;

  switch (currency) {
    case 'HSCT':
      return `${formattedNum} HSCT`;
    case 'USD': {
      const converted = (num * DEFAULT_USD_HSCT_RATE).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `${converted} HSCT`;
    }
    case 'INR':
      return `₹${formattedNum} INR`;
    default:
      return `${formattedNum} ${currency}`;
  }
}

/**
 * Sanitizes transaction descriptions by converting any "$X", "X USD", "X USDT" into "Y HSCT".
 * This eliminates legacy hardcoded dollar strings from transaction logs and descriptions.
 */
export function sanitizeTxDescription(desc?: string): string {
  if (!desc) return '';
  // Replace patterns like "$100", "$ 100", "$100.50"
  let sanitized = desc.replace(/\$\s*([\d,]+(?:\.\d+)?)/gi, (match, p1) => {
    const num = parseFloat(p1.replace(/,/g, ''));
    if (isNaN(num)) return match;
    const hsct = Math.round(num * DEFAULT_USD_HSCT_RATE);
    return `${hsct.toLocaleString()} HSCT`;
  });
  // Replace patterns like "100 USD", "100.50 USD", "100 USDT"
  sanitized = sanitized.replace(/([\d,]+(?:\.\d+)?)\s*(?:USD|USDT)\b/gi, (match, p1) => {
    const num = parseFloat(p1.replace(/,/g, ''));
    if (isNaN(num)) return match;
    const hsct = Math.round(num * DEFAULT_USD_HSCT_RATE);
    return `${hsct.toLocaleString()} HSCT`;
  });
  // Replace standalone "USD" or "USDT" mention if any remains
  sanitized = sanitized.replace(/\bUSD\b/g, 'HSCT').replace(/\bUSDT\b/g, 'HSCT');
  return sanitized;
}

/**
 * Returns a structured amount object containing canonical HSCT and derived values.
 */
export function getStructuredAmount(
  hsctAmount: number,
  usdRate: number = DEFAULT_USD_HSCT_RATE
): StructuredAmount {
  const safeHsct = isNaN(hsctAmount) ? 0 : hsctAmount;
  const usdEq = convertHsctToUsd(safeHsct, usdRate);
  const inrEq = convertHsctToInr(safeHsct);

  return {
    hsctAmount: safeHsct,
    usdEquivalent: usdEq,
    inrEquivalent: inrEq,
    currency: 'HSCT',
    formattedHsct: formatCurrency(safeHsct, 'HSCT'),
    formattedUsd: `${safeHsct.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HSCT`,
    formattedInr: formatCurrency(inrEq, 'INR'),
  };
}

/**
 * Helper for rendering transaction amounts natively in HSCT / Rupees (₹)
 */
export function formatTxAmountForDisplay(amount: number, currency: string = 'HSCT'): { primary: string; secondary: string } {
  const safeAmount = isNaN(amount) ? 0 : amount;
  const cleanCurr = (currency || 'HSCT').toUpperCase().trim();
  
  if (cleanCurr === 'USD' || cleanCurr === 'USDT') {
    const hsctAmount = safeAmount * DEFAULT_USD_HSCT_RATE;
    const formatted = hsctAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return {
      primary: `${formatted} HSCT`,
      secondary: `₹${formatted} INR`
    };
  }
  
  if (cleanCurr === 'HSCT' || cleanCurr === 'INR') {
    const formatted = safeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return {
      primary: `${formatted} HSCT`,
      secondary: `₹${formatted} INR`
    };
  }

  // Crypto assets like BTC, ETH, etc.
  return {
    primary: `${safeAmount} ${cleanCurr}`,
    secondary: `${cleanCurr} Asset`
  };
}
