import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

const initAdminApp = () => {
  if (!getApps().length) {
    if (!process.env.FIREBASE_PROJECT_ID) {
      throw new Error('Firebase credentials not set in .env');
    }
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getApp();
};

export const auth = () => {
  const app = initAdminApp();
  return getAuth(app);
};

export const getAdminDb = (): Firestore => {
  const app = initAdminApp();
  const databaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || 'securechainpay';
  try {
    return getFirestore(app, databaseId);
  } catch {
    return getFirestore(app);
  }
};

