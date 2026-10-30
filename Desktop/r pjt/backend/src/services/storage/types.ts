import { DocumentType } from '@prisma/client';

export type StorageProviderType = 'local' | 'ipfs' | 'filecoin';

export interface UploadDocumentParams {
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  documentType: DocumentType;
  title: string;
  vehicleId: string;
  uploadedById: string;
}

export interface StoredDocumentResult {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileHash: string; // SHA-256 canonical hash of binary
  ipfsCid?: string;
  storageProvider: StorageProviderType;
  isDevStorage: boolean;
}

export interface IStorageProvider {
  name: StorageProviderType;
  uploadDocument(params: UploadDocumentParams): Promise<StoredDocumentResult>;
  verifyIntegrity(fileBuffer: Buffer, expectedHash: string): boolean;
  getPublicGatewayUrl(cidOrUrl: string): string;
}
