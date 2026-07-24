import { ethers } from 'ethers';

export const generateMnemonic = (): string => {
  const wallet = ethers.Wallet.createRandom();
  if (wallet.mnemonic) {
    return wallet.mnemonic.phrase;
  }
  throw new Error("Could not generate mnemonic");
};

export const validateMnemonic = (mnemonic: string): boolean => {
  try {
    const wallet = ethers.Wallet.fromPhrase(mnemonic);
    return !!wallet.address;
  } catch (error) {
    return false;
  }
};

export const getAddressFromMnemonic = (mnemonic: string): string | null => {
  try {
    const wallet = ethers.Wallet.fromPhrase(mnemonic);
    return wallet.address;
  } catch (error) {
    return null;
  }
};
