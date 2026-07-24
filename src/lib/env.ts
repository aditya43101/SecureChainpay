import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  BLOCKCHAIN_RPC_URL: z.string().min(1, 'BLOCKCHAIN_RPC_URL is required'),
  SYSTEM_PRIVATE_KEY: z.string().min(1, 'SYSTEM_PRIVATE_KEY is required'),
  LEDGER_CONTRACT_ADDRESS: z.string().min(1, 'LEDGER_CONTRACT_ADDRESS is required'),
  WALLET_FACTORY_ADDRESS: z.string().min(1, 'WALLET_FACTORY_ADDRESS is required'),
  PAYMENT_CHANNEL_ADDRESS: z.string().min(1, 'PAYMENT_CHANNEL_ADDRESS is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  ENCRYPTION_KEY: z.string().min(1, 'ENCRYPTION_KEY is required'),
  
  // Firebase Web
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_API_KEY is required'),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is required'),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_PROJECT_ID is required'),
  
  // Cloudinary (Optional if KYC is disabled)
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Twilio (Optional if SMS is disabled)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // Brevo Email
  BREVO_API_KEY: z.string().optional(),
  BREVO_FROM_EMAIL: z.string().optional(),
  BREVO_FROM_NAME: z.string().optional(),
});

export function validateEnv() {
  const parsed = envSchema.safeParse(process.env);
  
  if (!parsed.success) {
    console.error('❌ ENVIRONMENT VALIDATION FAILED ❌');
    parsed.error.issues.forEach((err) => {
      console.error(`Missing or Invalid: ${err.path.join('.')} - ${err.message}`);
    });
    
    // In a Next.js server environment, we can throw an error to prevent startup
    if (typeof window === 'undefined') {
      throw new Error('Environment validation failed. See logs for missing variables.');
    }
  }
  
  console.log('✅ Environment Validation Passed');
  return parsed.data;
}
