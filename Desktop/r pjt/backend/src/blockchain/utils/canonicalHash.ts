import crypto from 'crypto';

export interface CanonicalVehicleInput {
  passportId: string;
  vin: string;
  registrationNumber: string;
  manufacturer: string;
  model: string;
  manufacturingYear: number;
  fuelType: string;
}

export interface CanonicalOwnershipInput {
  blockchainVehicleId: string;
  previousOwnerBlockchainId: string;
  newOwnerBlockchainId: string;
  transferType: string;
  transferDate: string | Date;
}

export interface CanonicalServiceInput {
  blockchainVehicleId: string;
  garageBlockchainId: string;
  serviceDate: string | Date;
  mileage: number;
  serviceType: string;
  description: string;
  partsReplaced?: string | null;
  cost?: number | null;
}

export interface CanonicalOdometerInput {
  blockchainVehicleId: string;
  mileage: number;
  recordedAt: string | Date;
  sourceType: string;
}

export interface CanonicalAccidentInput {
  blockchainVehicleId: string;
  accidentDate: string | Date;
  severity: string;
  description: string;
  damagedParts?: string | null;
  repairStatus?: string | null;
}

export interface CanonicalInsuranceInput {
  blockchainVehicleId: string;
  providerBlockchainId: string;
  policyReference: string;
  startDate: string | Date;
  endDate: string | Date;
  coverageType: string;
}

export interface CanonicalDocumentInput {
  blockchainVehicleId: string;
  documentType: string;
  fileHash: string;
  title: string;
}

function formatDateISO(d: string | Date): string {
  if (typeof d === 'string') {
    return new Date(d).toISOString().split('T')[0];
  }
  return d.toISOString().split('T')[0];
}

/**
 * Deterministically serializes a vehicle record into a canonical string format:
 * `${passportId}|${vin}|${registrationNumber}|${manufacturer}|${model}|${manufacturingYear}|${fuelType}`
 */
export function generateCanonicalVehicleString(vehicle: CanonicalVehicleInput): string {
  const passportId = vehicle.passportId.trim().toUpperCase();
  const vin = vehicle.vin.trim().toUpperCase();
  const registrationNumber = vehicle.registrationNumber.trim().toUpperCase().replace(/[\s-]/g, '');
  const manufacturer = vehicle.manufacturer.trim();
  const model = vehicle.model.trim();
  const manufacturingYear = String(vehicle.manufacturingYear);
  const fuelType = vehicle.fuelType.trim().toUpperCase();

  return `${passportId}|${vin}|${registrationNumber}|${manufacturer}|${model}|${manufacturingYear}|${fuelType}`;
}

/**
 * Computes SHA-256 cryptographic hash of canonical vehicle data
 */
export function generateVehicleRecordHash(vehicle: CanonicalVehicleInput): string {
  const canonical = generateCanonicalVehicleString(vehicle);
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `0x${hash}`;
}

/**
 * Computes SHA-256 user reference hash from Firebase UID
 */
export function generateUserReferenceHash(firebaseUid: string): string {
  const hash = crypto.createHash('sha256').update(firebaseUid.trim(), 'utf8').digest('hex');
  return `0x${hash}`;
}

/**
 * Computes SHA-256 hash for ownership transfer record
 */
export function generateOwnershipRecordHash(input: CanonicalOwnershipInput): string {
  const dateStr = formatDateISO(input.transferDate);
  const canonical = `${input.blockchainVehicleId.trim()}|${input.previousOwnerBlockchainId.trim()}|${input.newOwnerBlockchainId.trim()}|${input.transferType.trim().toUpperCase()}|${dateStr}`;
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `0x${hash}`;
}

/**
 * Computes SHA-256 hash for service record
 */
export function generateServiceRecordHash(input: CanonicalServiceInput): string {
  const dateStr = formatDateISO(input.serviceDate);
  const parts = (input.partsReplaced || 'NONE').trim();
  const cost = input.cost !== null && input.cost !== undefined ? input.cost.toFixed(2) : '0.00';
  const canonical = `${input.blockchainVehicleId.trim()}|${input.garageBlockchainId.trim()}|${dateStr}|${input.mileage}|${input.serviceType.trim().toUpperCase()}|${input.description.trim()}|${parts}|${cost}`;
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `0x${hash}`;
}

/**
 * Computes SHA-256 hash for odometer record
 */
export function generateOdometerRecordHash(input: CanonicalOdometerInput): string {
  const dateStr = formatDateISO(input.recordedAt);
  const canonical = `${input.blockchainVehicleId.trim()}|${input.mileage}|${dateStr}|${input.sourceType.trim().toUpperCase()}`;
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `0x${hash}`;
}

/**
 * Computes SHA-256 hash for accident record
 */
export function generateAccidentRecordHash(input: CanonicalAccidentInput): string {
  const dateStr = formatDateISO(input.accidentDate);
  const parts = (input.damagedParts || 'NONE').trim();
  const repair = (input.repairStatus || 'PENDING').trim().toUpperCase();
  const canonical = `${input.blockchainVehicleId.trim()}|${dateStr}|${input.severity.trim().toUpperCase()}|${input.description.trim()}|${parts}|${repair}`;
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `0x${hash}`;
}

/**
 * Computes SHA-256 hash for insurance record
 */
export function generateInsuranceRecordHash(input: CanonicalInsuranceInput): string {
  const startStr = formatDateISO(input.startDate);
  const endStr = formatDateISO(input.endDate);
  const canonical = `${input.blockchainVehicleId.trim()}|${input.providerBlockchainId.trim()}|${input.policyReference.trim().toUpperCase()}|${startStr}|${endStr}|${input.coverageType.trim().toUpperCase()}`;
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `0x${hash}`;
}

/**
 * Computes SHA-256 hash for document record
 */
export function generateDocumentRecordHash(input: CanonicalDocumentInput): string {
  const canonical = `${input.blockchainVehicleId.trim()}|${input.documentType.trim().toUpperCase()}|${input.fileHash.trim().toLowerCase()}|${input.title.trim()}`;
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `0x${hash}`;
}

/* ---------------- Phase 4: Industry & EV Ecosystem Hashes ---------------- */

export interface CanonicalManufacturerCertificateInput {
  blockchainVehicleId: string;
  certificateNumber: string;
  manufacturingDate: string | Date;
  manufacturingPlant?: string | null;
  initialOdometer: number;
}

export function generateManufacturerCertificateHash(input: CanonicalManufacturerCertificateInput): string {
  const dateStr = formatDateISO(input.manufacturingDate);
  const plant = (input.manufacturingPlant || 'ORIGIN_PLANT').trim().toUpperCase();
  const canonical = `${input.blockchainVehicleId.trim()}|${input.certificateNumber.trim().toUpperCase()}|${dateStr}|${plant}|${input.initialOdometer}`;
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `0x${hash}`;
}

export interface CanonicalBatteryPassportInput {
  blockchainVehicleId: string;
  batterySerial: string;
  chemistry: string;
  nominalCapacityKwh: number;
  manufactureDate: string | Date;
}

export function generateBatteryPassportHash(input: CanonicalBatteryPassportInput): string {
  const dateStr = formatDateISO(input.manufactureDate);
  const canonical = `${input.blockchainVehicleId.trim()}|${input.batterySerial.trim().toUpperCase()}|${input.chemistry.trim().toUpperCase()}|${input.nominalCapacityKwh.toFixed(1)}|${dateStr}`;
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `0x${hash}`;
}

export interface CanonicalBatteryEventInput {
  blockchainVehicleId: string;
  batterySerial: string;
  eventType: string;
  eventDate: string | Date;
  capacityKwh?: number | null;
  sohPercentage?: number | null;
}

export function generateBatteryEventHash(input: CanonicalBatteryEventInput): string {
  const dateStr = formatDateISO(input.eventDate);
  const cap = input.capacityKwh ? input.capacityKwh.toFixed(1) : 'NA';
  const soh = input.sohPercentage ? input.sohPercentage.toFixed(1) : 'NA';
  const canonical = `${input.blockchainVehicleId.trim()}|${input.batterySerial.trim().toUpperCase()}|${input.eventType.trim().toUpperCase()}|${dateStr}|${cap}|${soh}`;
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `0x${hash}`;
}

export interface CanonicalInsuranceClaimInput {
  blockchainVehicleId: string;
  claimNumber: string;
  claimDate: string | Date;
  claimAmount?: number | null;
  claimStatus: string;
}

export function generateInsuranceClaimHash(input: CanonicalInsuranceClaimInput): string {
  const dateStr = formatDateISO(input.claimDate);
  const amt = input.claimAmount ? input.claimAmount.toFixed(2) : '0.00';
  const canonical = `${input.blockchainVehicleId.trim()}|${input.claimNumber.trim().toUpperCase()}|${dateStr}|${amt}|${input.claimStatus.trim().toUpperCase()}`;
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `0x${hash}`;
}

export interface CanonicalGarageVerificationInput {
  garageBlockchainId: string;
  businessName: string;
  licenseNumber?: string | null;
  verificationStatus: string;
  trustIndex: number;
}

export function generateGarageVerificationHash(input: CanonicalGarageVerificationInput): string {
  const license = (input.licenseNumber || 'UNLICENSED').trim().toUpperCase();
  const canonical = `${input.garageBlockchainId.trim()}|${input.businessName.trim().toUpperCase()}|${license}|${input.verificationStatus.trim().toUpperCase()}|${input.trustIndex.toFixed(1)}`;
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `0x${hash}`;
}
