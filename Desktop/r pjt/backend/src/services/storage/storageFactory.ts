import { IStorageProvider } from './types';
import { LocalDevStorageProvider } from './LocalDevStorageProvider';
import { IPFSStorageProvider } from './IPFSStorageProvider';

let instance: IStorageProvider | null = null;

export function getStorageProvider(): IStorageProvider {
  if (!instance) {
    const providerType = process.env.STORAGE_PROVIDER?.toLowerCase() || 'local';
    if (providerType === 'ipfs') {
      console.log('📦 [STORAGE] Initialized IPFS Storage Provider');
      instance = new IPFSStorageProvider();
    } else {
      console.log('📦 [STORAGE] Initialized Local Dev Storage Provider');
      instance = new LocalDevStorageProvider();
    }
  }
  return instance;
}
