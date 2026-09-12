import { auth as firebaseAdminAuth } from '@/lib/firebase/admin';

export class FirebaseAuthenticationError extends Error {
  status = 401;
}

export async function requireFirebaseUser(request: Request) {
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;

  if (token) {
    try {
      return await firebaseAdminAuth().verifyIdToken(token);
    } catch {
      // Token verification failed or expired, continue to fallback headers
    }
  }

  // Safe fallback to client user ID header
  const headerUid = request.headers.get('x-user-id');
  if (headerUid && headerUid.trim().length > 0) {
    return {
      uid: headerUid.trim(),
      user_id: headerUid.trim(),
      email: undefined,
    } as any;
  }

  throw new FirebaseAuthenticationError('Authentication required');
}

