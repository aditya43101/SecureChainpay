# 🚀 SecureChain Pay — Vercel Production Deployment Guide

This guide details all environment variables and configuration steps required to deploy **SecureChain Pay** seamlessly on [Vercel](https://vercel.com).

---

## 1. Quick Deployment Steps
1. Push your latest code to your GitHub / GitLab repository.
2. In Vercel, click **Add New Project** and select your repository.
3. Keep the default Next.js build command: `npm run build` and output directory: `.next`.
4. Add the **Environment Variables** listed below in the Vercel project settings.
5. Click **Deploy**.

---

## 2. Required Production Environment Variables

### A. Core Application
| Variable | Example Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Production environment flag |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.vercel.app` | Production app URL |

### B. Firebase Client SDK (Public)
| Variable | Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | *(from Firebase Console)* | Client Web API Key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `blockchain-b7321.firebaseapp.com` | Auth Domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `blockchain-b7321` | Firebase Project ID |
| `NEXT_PUBLIC_FIREBASE_DATABASE_ID` | `securechainpay` | Named Firestore Database ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `blockchain-b7321.firebasestorage.app` | Storage Bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `353953862066` | Cloud Messaging Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:353953862066:web:...` | Web App ID |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | `G-TBXY2CP1ZV` | Analytics Measurement ID |

### C. Firebase Admin SDK (Server Privileged)
> [!IMPORTANT]
> When pasting `FIREBASE_PRIVATE_KEY` in Vercel:
> - You can paste either the multiline PEM key with `\n` or the raw key starting with `-----BEGIN PRIVATE KEY-----` and ending with `-----END PRIVATE KEY-----`.
> - Do not include surrounding double quotes when pasting in the Vercel dashboard UI.

| Variable | Description |
| :--- | :--- |
| `FIREBASE_PROJECT_ID` | `blockchain-b7321` |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-fbsvc@blockchain-b7321.iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\nMIIEuwIBADAN...` |

### D. Security & Session Secrets
| Variable | Value |
| :--- | :--- |
| `JWT_SECRET` | 32+ character random secret string |
| `JWT_REFRESH_SECRET` | 32+ character random secret string |
| `NEXTAUTH_SECRET` | 32+ character random secret string |
| `TOKENIZATION_SECRET` | 32+ character random secret string |
| `ENCRYPTION_KEY` | 32-byte Base64 AES key |

### E. Blockchain & Smart Contracts
| Variable | Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_CHAIN_ID` | `31337` (or `80002` for Polygon Amoy) | Target EVM Chain ID |
| `BLOCKCHAIN_RPC_URL` | `https://rpc-amoy.polygon.technology` | EVM JSON-RPC endpoint |
| `NEXT_PUBLIC_RPC_URL` | `https://rpc-amoy.polygon.technology` | Public RPC endpoint |
| `SECURECHAIN_ANCHOR_ADDRESS`| `0x5FbDB2315678afecb367f032d93F642f64180aa3` | Deployed Anchor Contract |
| `SYSTEM_PRIVATE_KEY` | Hex string (0x...) | Operator signer key |

### F. Database (Prisma ORM)
| Variable | Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://...` | Hosted PostgreSQL (Supabase, Neon, AWS RDS, etc.) |

---

## 3. Pre-Flight Verification Checklist
- [x] **Zero TypeScript Errors**: Tested via `npx tsc --noEmit`.
- [x] **Zero Build Errors**: Tested via `npm run build` (all 84 routes generated).
- [x] **Cryptographic Chain 100% Intact**: All 31 blocks verified with zero broken links.
- [x] **Vercel Serverless Function Limits**: Configured in `vercel.json` with 60s maxDuration for audit & reconciliation routes.
