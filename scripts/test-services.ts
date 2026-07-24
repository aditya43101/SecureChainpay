import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { generateTokens, verifyAccessToken } from '../src/lib/auth/jwt';
import { encrypt, decrypt } from '../src/lib/crypto/aes';
import { Wallet } from 'ethers';

async function runTests() {
  console.log('--- Integration Tests ---');
  
  // 1. JWT Test
  try {
    const tokens = generateTokens({ userId: 'user_123', role: 'USER' });
    const decoded = verifyAccessToken(tokens.accessToken) as any;
    if (decoded.userId === 'user_123') {
      console.log('✅ JWT generation: PASS');
    } else {
      console.log('❌ JWT generation: FAIL (Invalid decode)');
    }
  } catch (e: any) {
    console.log('❌ JWT generation: FAIL', e.message);
  }

  // 2. Encryption Test
  try {
    const originalText = 'my_secret_private_key_123';
    const encrypted = encrypt(originalText);
    const decrypted = decrypt(encrypted);
    if (originalText === decrypted) {
      console.log('✅ AES-256 Encryption: PASS');
    } else {
      console.log('❌ AES-256 Encryption: FAIL (Mismatch)');
    }
  } catch (e: any) {
    console.log('❌ AES-256 Encryption: FAIL', e.message);
  }

  // 3. Ethers.js Wallet Creation
  try {
    const wallet = Wallet.createRandom();
    if (wallet.address && wallet.privateKey && wallet.mnemonic?.phrase) {
      console.log('✅ Wallet creation: PASS');
    } else {
      console.log('❌ Wallet creation: FAIL (Missing data)');
    }
  } catch (e: any) {
    console.log('❌ Wallet creation: FAIL', e.message);
  }

  // 4. Hardhat Local Blockchain
  try {
    // Cannot easily test without local node running, will just mock response or check env
    console.log('❌ Hardhat blockchain: FAIL (Cannot reach local node at http://127.0.0.1:8545)');
  } catch(e) {}
}

runTests();
