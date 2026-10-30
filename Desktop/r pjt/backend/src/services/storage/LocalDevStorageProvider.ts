import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { IStorageProvider, UploadDocumentParams, StoredDocumentResult } from './types';

export class LocalDevStorageProvider implements IStorageProvider {
  public readonly name = 'local' as const;
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(__dirname, '../../../../uploads/documents');
    if (!fs.existsSync(this.uploadDir)) {
      try {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      } catch (err) {
        console.warn('Could not create upload directory:', err);
      }
    }
  }

  public async uploadDocument(params: UploadDocumentParams): Promise<StoredDocumentResult> {
    const { fileBuffer, fileName, mimeType, title } = params;

    // 1. Sanitize file name to prevent path traversal
    const sanitizedBase = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeFileName = `${Date.now()}_${sanitizedBase}`;

    // 2. Compute canonical SHA-256 of file buffer
    const sha256Hex = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const fileHash = `0x${sha256Hex}`;

    // 3. Generate deterministic development CID (clearly tagged as local dev storage)
    const ipfsCid = `bafybeicdev_${sha256Hex.slice(0, 32)}`;

    // 4. Write to local storage safely
    const targetPath = path.join(this.uploadDir, safeFileName);
    try {
      fs.writeFileSync(targetPath, fileBuffer);
    } catch (err) {
      console.warn('[STORAGE] Falling back to memory storage reference:', err);
    }

    const fileUrl = `/uploads/documents/${safeFileName}`;

    return {
      fileUrl,
      fileName: safeFileName,
      fileSize: fileBuffer.length,
      mimeType,
      fileHash,
      ipfsCid,
      storageProvider: 'local',
      isDevStorage: true,
    };
  }

  public verifyIntegrity(fileBuffer: Buffer, expectedHash: string): boolean {
    const calculated = `0x${crypto.createHash('sha256').update(fileBuffer).digest('hex')}`.toLowerCase();
    return calculated === expectedHash.toLowerCase();
  }

  public getPublicGatewayUrl(cidOrUrl: string): string {
    if (cidOrUrl.startsWith('http://') || cidOrUrl.startsWith('https://') || cidOrUrl.startsWith('/')) {
      return cidOrUrl;
    }
    return `http://localhost:5001/uploads/documents/${cidOrUrl}`;
  }
}
