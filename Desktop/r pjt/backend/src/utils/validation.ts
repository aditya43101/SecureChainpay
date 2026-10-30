/**
 * VIN and Registration validation and normalization utilities
 */

export function validateAndNormalizeVin(vin: string): { valid: boolean; normalized: string; error?: string } {
  if (!vin || typeof vin !== 'string') {
    return { valid: false, normalized: '', error: 'VIN is required' };
  }

  const normalized = vin.trim().toUpperCase().replace(/[\s-]/g, '');

  if (normalized.length !== 17) {
    return {
      valid: false,
      normalized,
      error: `VIN must be exactly 17 characters (provided ${normalized.length})`,
    };
  }

  // Standard VIN contains alphanumeric characters excluding I, O, Q
  const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/;
  if (!vinRegex.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'VIN contains invalid characters. Letters I, O, and Q are prohibited by ISO 3779 standard.',
    };
  }

  return { valid: true, normalized };
}

export function validateAndNormalizeRegistration(registration: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  if (!registration || typeof registration !== 'string') {
    return { valid: false, normalized: '', error: 'Registration number is required' };
  }

  const normalized = registration.trim().toUpperCase().replace(/[\s-]/g, '');

  if (normalized.length < 4 || normalized.length > 15) {
    return {
      valid: false,
      normalized,
      error: 'Registration number must be between 4 and 15 alphanumeric characters',
    };
  }

  const regRegex = /^[A-Z0-9]+$/;
  if (!regRegex.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Registration number must contain only letters and numbers',
    };
  }

  return { valid: true, normalized };
}
