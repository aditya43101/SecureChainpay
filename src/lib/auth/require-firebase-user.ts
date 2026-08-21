import { auth as firebaseAdminAuth } from '@/lib/firebase/admin';

export class FirebaseAuthenticationError extends Error {
  status = 401;
}

export async function requireFirebaseUser(request: Request) {
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;

  if (!token) {
    throw new FirebaseAuthenticationError('Missing Firebase authentication token');
  }

  try {
    return await firebaseAdminAuth().verifyIdToken(token);
  } catch {
    throw new FirebaseAuthenticationError('Invalid or expired Firebase authentication token');
  }
}
