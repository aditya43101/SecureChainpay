import { DocumentType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import {
  ExtractedDocumentFields,
  ConsistencyEvaluationResult,
  ConsistencyFieldComparison,
  ConsistencyStatus,
} from './types';

export async function evaluateDocumentConsistency(
  vehicleId: string,
  documentType: DocumentType,
  fields: ExtractedDocumentFields
): Promise<ConsistencyEvaluationResult> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: {
      odometerRecords: { orderBy: { recordedAt: 'desc' }, take: 1 },
      serviceRecords: { orderBy: { serviceDate: 'desc' }, take: 3 },
      insuranceRecords: { orderBy: { startDate: 'desc' }, take: 1 },
    },
  });

  if (!vehicle) {
    throw new Error(`Vehicle ${vehicleId} not found for consistency check`);
  }

  const comparisons: ConsistencyFieldComparison[] = [];
  let matches = 0;
  let mismatches = 0;
  let checks = 0;

  // 1. VIN Comparison
  if (fields.vin) {
    checks++;
    const isVinMatch = fields.vin.toUpperCase() === vehicle.vin.toUpperCase();
    if (isVinMatch) {
      matches++;
      comparisons.push({
        field: 'vin',
        label: 'Vehicle Identification Number (VIN)',
        documentValue: fields.vin,
        databaseValue: vehicle.vin,
        status: 'MATCH',
        severity: 'INFO',
        message: 'VIN in document exactly matches official blockchain-anchored vehicle record.',
      });
    } else {
      mismatches++;
      comparisons.push({
        field: 'vin',
        label: 'Vehicle Identification Number (VIN)',
        documentValue: fields.vin,
        databaseValue: vehicle.vin,
        status: 'MISMATCH',
        severity: 'CRITICAL',
        message: `VIN mismatch! Document shows ${fields.vin}, but database record is ${vehicle.vin}.`,
      });
    }
  }

  // 2. Registration Number Comparison
  if (fields.registrationNumber) {
    checks++;
    const cleanDocReg = fields.registrationNumber.replace(/\s+/g, '').toUpperCase();
    const cleanDbReg = vehicle.registrationNumber.replace(/\s+/g, '').toUpperCase();
    const isRegMatch = cleanDocReg === cleanDbReg;

    if (isRegMatch) {
      matches++;
      comparisons.push({
        field: 'registrationNumber',
        label: 'Registration Plate Number',
        documentValue: fields.registrationNumber,
        databaseValue: vehicle.registrationNumber,
        status: 'MATCH',
        severity: 'INFO',
        message: 'Registration plate number matches database.',
      });
    } else {
      mismatches++;
      comparisons.push({
        field: 'registrationNumber',
        label: 'Registration Plate Number',
        documentValue: fields.registrationNumber,
        databaseValue: vehicle.registrationNumber,
        status: 'MISMATCH',
        severity: 'WARNING',
        message: `Registration mismatch: Document has ${fields.registrationNumber}, official DB has ${vehicle.registrationNumber}.`,
      });
    }
  }

  // 3. Mileage / Odometer Comparison (especially for Service Invoice or Inspection)
  if (fields.mileage !== undefined && fields.mileage !== null) {
    checks++;
    const latestOdometer = vehicle.odometerRecords[0]?.mileage || 0;
    // Check if document mileage matches or is reasonably close (e.g. <= latest known odometer)
    const exactServiceMatch = vehicle.serviceRecords.some((s) => s.mileage === fields.mileage);
    const isClose = Math.abs(fields.mileage - latestOdometer) < 5000;

    if (exactServiceMatch) {
      matches++;
      comparisons.push({
        field: 'mileage',
        label: 'Odometer Mileage Reading',
        documentValue: `${fields.mileage.toLocaleString()} km`,
        databaseValue: `${latestOdometer.toLocaleString()} km`,
        status: 'MATCH',
        severity: 'INFO',
        message: `Odometer in document matches a verified garage service record.`,
      });
    } else if (isClose || fields.mileage <= latestOdometer + 1000) {
      matches++;
      comparisons.push({
        field: 'mileage',
        label: 'Odometer Mileage Reading',
        documentValue: `${fields.mileage.toLocaleString()} km`,
        databaseValue: `${latestOdometer.toLocaleString()} km`,
        status: 'MATCH',
        severity: 'INFO',
        message: `Mileage reading is consistent with latest recorded odometer (${latestOdometer.toLocaleString()} km).`,
      });
    } else {
      mismatches++;
      comparisons.push({
        field: 'mileage',
        label: 'Odometer Mileage Reading',
        documentValue: `${fields.mileage.toLocaleString()} km`,
        databaseValue: `${latestOdometer.toLocaleString()} km`,
        status: 'MISMATCH',
        severity: 'WARNING',
        message: `Unusual mileage variance: Document states ${fields.mileage.toLocaleString()} km, but latest verified odometer is ${latestOdometer.toLocaleString()} km.`,
      });
    }
  }

  // 4. Policy Number Comparison (for Insurance Policy)
  if (fields.policyNumber) {
    checks++;
    const matchingPolicy = vehicle.insuranceRecords.find(
      (ins) => ins.policyReference.toLowerCase() === fields.policyNumber!.toLowerCase()
    );
    if (matchingPolicy) {
      matches++;
      comparisons.push({
        field: 'policyNumber',
        label: 'Insurance Policy Reference',
        documentValue: fields.policyNumber,
        databaseValue: matchingPolicy.policyReference,
        status: 'MATCH',
        severity: 'INFO',
        message: `Policy reference confirmed against verified insurance ledger.`,
      });
    } else {
      comparisons.push({
        field: 'policyNumber',
        label: 'Insurance Policy Reference',
        documentValue: fields.policyNumber,
        databaseValue: vehicle.insuranceRecords[0]?.policyReference || 'None',
        status: 'MISMATCH',
        severity: 'WARNING',
        message: `Policy number ${fields.policyNumber} is not currently registered on the vehicle insurance ledger.`,
      });
      mismatches++;
    }
  }

  // 5. Evaluate Overall Consistency Status
  let status: ConsistencyStatus = 'UNVERIFIED';
  let score = 0;
  let summary = '';

  if (checks === 0) {
    status = 'UNVERIFIED';
    score = 50;
    summary = 'No extractable reference fields (VIN, Plate, Mileage) were detected in the document text.';
  } else if (mismatches === 0 && matches > 0) {
    status = 'CONSISTENT';
    score = 100;
    summary = `All ${matches} extracted document fields match database and blockchain records with 100% integrity.`;
  } else if (matches > 0 && mismatches > 0) {
    status = 'PARTIAL';
    score = Math.round((matches / checks) * 100);
    summary = `${matches} of ${checks} fields match official records. ${mismatches} discrepancy requires manual inspection.`;
  } else {
    status = 'INCONSISTENT';
    score = 0;
    summary = `Critical discrepancies detected: Document fields do not match verified database records.`;
  }

  return {
    status,
    score,
    summary,
    comparisons,
    timestamp: new Date().toISOString(),
  };
}
