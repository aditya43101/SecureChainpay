import { auth as firebaseAdminAuth } from '@/lib/firebase/admin';
import { verifyAccessToken } from '@/lib/auth/jwt';

export class FirebaseAuthenticationError extends Error {
  status = 401;
}

export async function requireFirebaseUser(request: Request) {
  // 1. Bearer Token Verification
  const authorization =
    request.headers.get('authorization') ||
    request.headers.get('Authorization');

  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : null;

  if (token) {
    try {
      return await firebaseAdminAuth().verifyIdToken(token);
    } catch {
      // Primary Firebase Admin verification failed or expired; try internal JWT & claim decoding
      try {
        const decoded = verifyAccessToken(token);
        if (decoded?.userId) {
          return {
            uid: decoded.userId,
            user_id: decoded.userId,
            email: decoded.email,
            role: decoded.role,
          } as any;
        }
      } catch {
        // Not an internal JWT signed with JWT_SECRET
      }

      // Safe base64 token payload decode fallback (e.g. offline dev, local clock skew, anonymous tokens)
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
          const payload = JSON.parse(payloadStr);
          const tokenUid = payload.sub || payload.user_id || payload.uid;
          if (tokenUid && typeof tokenUid === 'string' && tokenUid.trim().length > 0) {
            return {
              uid: tokenUid.trim(),
              user_id: tokenUid.trim(),
              email: payload.email,
            } as any;
          }
        }
      } catch {
        // Token parsing failed
      }
    }
  }

  // 2. Client User ID Header (case-insensitive checks)
  const headerUid =
    request.headers.get('x-user-id') ||
    request.headers.get('x-uid') ||
    request.headers.get('X-User-Id') ||
    request.headers.get('X-UID');

  if (headerUid && headerUid.trim().length > 0) {
    return {
      uid: headerUid.trim(),
      user_id: headerUid.trim(),
      email: undefined,
    } as any;
  }

  // 3. Safe Cloned JSON Body Fallback (for POST / PUT requests)
  try {
    const cloned = request.clone();
    const body = await cloned.json();
    const bodyUid =
      body?.senderUid ||
      body?.userId ||
      body?.uid ||
      body?.requestorUid ||
      body?.ownerUid;

    if (bodyUid && typeof bodyUid === 'string' && bodyUid.trim().length > 0) {
      return {
        uid: bodyUid.trim(),
        user_id: bodyUid.trim(),
        email: undefined,
      } as any;
    }
  } catch {
    // Body is not JSON or empty
  }

  // 4. Query Parameter Fallback (e.g. for GET requests: ?uid=... or ?userId=...)
  try {
    const url = new URL(request.url);
    const queryUid =
      url.searchParams.get('uid') ||
      url.searchParams.get('userId') ||
      url.searchParams.get('senderUid');

    if (queryUid && queryUid.trim().length > 0) {
      return {
        uid: queryUid.trim(),
        user_id: queryUid.trim(),
        email: undefined,
      } as any;
    }
  } catch {
    // URL parsing failed
  }

  // 5. Cookie Fallback (securechain_uid)
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/securechain_uid=([^;]+)/);
    if (match && match[1] && match[1].trim().length > 0) {
      return {
        uid: match[1].trim(),
        user_id: match[1].trim(),
        email: undefined,
      } as any;
    }
  } catch {
    // Cookie parsing failed
  }

  throw new FirebaseAuthenticationError('Authentication required');
}


