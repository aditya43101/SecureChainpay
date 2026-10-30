import { DocumentType } from '@prisma/client';

export interface ExtractedDocumentFields {
  vin?: string;
  registrationNumber?: string;
  vehicleModel?: string;
  manufacturer?: string;
  mileage?: number;
  documentDate?: string;
  garageName?: string;
  technicianName?: string;
  policyNumber?: string;
  insurerName?: string;
  accidentSeverity?: string;
  invoiceNumber?: string;
  cost?: number;
  confidenceScore: number; // 0.0 - 1.0
  rawTextSnippet?: string;
}

export type ConsistencyStatus = 'CONSISTENT' | 'INCONSISTENT' | 'PARTIAL' | 'UNVERIFIED';

export interface ConsistencyFieldComparison {
  field: string;
  label: string;
  documentValue: any;
  databaseValue: any;
  status: 'MATCH' | 'MISMATCH' | 'MISSING_IN_DOC' | 'MISSING_IN_DB';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
}

export interface ConsistencyEvaluationResult {
  status: ConsistencyStatus;
  score: number; // 0 - 100 percentage of consistency
  summary: string;
  comparisons: ConsistencyFieldComparison[];
  timestamp: string;
}

export interface OCRExtractionResult {
  provider: string;
  fields: ExtractedDocumentFields;
  processingTimeMs: number;
  success: boolean;
  error?: string;
}

export interface DocumentOCRProvider {
  name: string;
  extractText(
    fileBuffer: Buffer,
    mimeType: string,
    documentType: DocumentType,
    hints?: {
      expectedVin?: string;
      expectedRegistration?: string;
      expectedModel?: string;
    }
  ): Promise<OCRExtractionResult>;
}
