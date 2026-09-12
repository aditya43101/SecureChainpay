import { requireFirebaseUser, FirebaseAuthenticationError } from '@/lib/auth/require-firebase-user';
import { getAdminDb } from '@/lib/firebase/admin';

export class AuthorizationError extends Error {
  status = 403;
}

/**
 * Validates that the request has a valid Firebase token AND the user has an 'admin' role,
 * either in their verified custom claims or in their authoritative Firestore users/{uid} document.
 */
export async function requireAdminUser(request: Request) {
  const authUser = await requireFirebaseUser(request);

  // Check 1: Custom Claims
  if (authUser.role === 'admin' || authUser.admin === true) {
    return authUser;
  }

  // Check 2: Authoritative Database Document
  const adminDb = getAdminDb();
  const userDoc = await adminDb.collection('users').doc(authUser.uid).get();

  if (userDoc.exists) {
    const data = userDoc.data();
    if (data?.role === 'admin' || data?.isAdmin === true) {
      return authUser;
    }
  }

  throw new AuthorizationError('Forbidden: Administrative privileges required');
}
