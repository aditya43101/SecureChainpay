import crypto from 'crypto';
import path from 'path';
import { IStorageProvider, UploadDocumentParams, StoredDocumentResult } from './types';
import { LocalDevStorageProvider } from './LocalDevStorageProvider';

export class IPFSStorageProvider implements IStorageProvider {
  public readonly name = 'ipfs' as const;
  private devFallback: LocalDevStorageProvider;
  private pinataJwt: string | undefined;
  private ipfsGateway: string;

  constructor() {
    this.devFallback = new LocalDevStorageProvider();
    this.pinataJwt = process.env.PINATA_JWT || process.env.IPFS_API_KEY;
    this.ipfsGateway = process.env.IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs';
  }

  public async uploadDocument(params: UploadDocumentParams): Promise<StoredDocumentResult> {
    const { fileBuffer, fileName, mimeType } = params;

    // Check if real production IPFS credentials are configured
    if (!this.pinataJwt) {
      console.log('ℹ️ [IPFS] No production IPFS credentials found. Operating in DEV STORAGE mode with local provider.');
      return this.devFallback.uploadDocument(params);
    }

    try {
      // Production IPFS upload implementation via Pinata standard REST API
      const formData = new FormData();
      const blob = new Blob([fileBuffer as any], { type: mimeType });
      formData.append('file', blob as any, path.basename(fileName));

      const pinataMetadata = JSON.stringify({
        name: fileName,
        keyvalues: {
          vehicleId: params.vehicleId,
          documentType: params.documentType,
          uploadedBy: params.uploadedById,
        },
      });
      formData.append('pinataMetadata', pinataMetadata);

      const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.pinataJwt}`,
        },
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Pinata IPFS error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const ipfsHash = data.IpfsHash; // Real IPFS CIDv0 or CIDv1
      const sha256Hex = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      return {
        fileUrl: `${this.ipfsGateway}/${ipfsHash}`,
        fileName: path.basename(fileName),
        fileSize: fileBuffer.length,
        mimeType,
        fileHash: `0x${sha256Hex}`,
        ipfsCid: ipfsHash,
        storageProvider: 'ipfs',
        isDevStorage: false,
      };
    } catch (err) {
      console.warn('⚠️ [IPFS] Production IPFS upload failed, falling back to local dev storage:', err);
      return this.devFallback.uploadDocument(params);
    }
  }

  public verifyIntegrity(fileBuffer: Buffer, expectedHash: string): boolean {
    const calculated = `0x${crypto.createHash('sha256').update(fileBuffer).digest('hex')}`.toLowerCase();
    return calculated === expectedHash.toLowerCase();
  }

  public getPublicGatewayUrl(cidOrUrl: string): string {
    if (cidOrUrl.startsWith('http://') || cidOrUrl.startsWith('https://')) {
      return cidOrUrl;
    }
    return `${this.ipfsGateway}/${cidOrUrl}`;
  }
}
