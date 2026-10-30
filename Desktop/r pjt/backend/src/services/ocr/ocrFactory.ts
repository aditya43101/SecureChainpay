import { DocumentOCRProvider } from './types';
import { DefaultHeuristicOCRProvider } from './DefaultHeuristicOCRProvider';

let ocrProviderInstance: DocumentOCRProvider | null = null;

export function getOCRProvider(): DocumentOCRProvider {
  if (!ocrProviderInstance) {
    // Default heuristic engine (can be swapped via OCR_PROVIDER env)
    ocrProviderInstance = new DefaultHeuristicOCRProvider();
  }
  return ocrProviderInstance;
}
