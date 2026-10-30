import * as admin from 'firebase-admin';

let isFirebaseAdminInitialized = false;

try {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    isFirebaseAdminInitialized = true;
    console.log('🔒 Firebase Admin SDK initialized with service account.');
  } else {
    console.log('ℹ️ Firebase Admin SDK running in local development mode.');
  }
} catch (error) {
  console.warn('⚠️ Firebase Admin SDK initialization warning:', error);
}

export { admin, isFirebaseAdminInitialized };

export interface VerifiedFirebaseToken {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}

export async function verifyFirebaseIdToken(token: string): Promise<VerifiedFirebaseToken | null> {
  // 1. If Firebase Admin is properly configured with credentials:
  if (isFirebaseAdminInitialized) {
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      return {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
      };
    } catch (err) {
      console.error('Firebase ID token verification failed:', err);
      return null;
    }
  }

  // 2. Development mock token format: "dev-seed-token:<uid>:<email>"
  if (token.startsWith('dev-seed-token:')) {
    const [, uid, email, name] = token.split(':');
    if (uid) {
      return {
        uid,
        email: email || `${uid}@vehiclepassport.dev`,
        name: name || uid,
      };
    }
  }

  // 3. Local fallback for dev/testing when Firebase service account credentials are not configured:
  // Decodes client-provided Firebase JWT payload safely for development
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
      if (payload.user_id || payload.sub || payload.uid) {
        return {
          uid: payload.user_id || payload.sub || payload.uid,
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
        };
      }
    }
  } catch (err) {
    console.warn('Could not parse token in dev fallback mode:', err);
  }

  return null;
}
