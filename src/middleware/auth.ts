import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { adminUsers, userProfiles, users } from '../db/schema.ts';

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(process.env.SQL_DB_NAME || 'murthu-job-hub-dev-secret').digest('hex');

const DEFAULT_ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'luckymurthu@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export interface AuthenticatedUser {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  isSuspended: boolean;
  emailVerified: boolean;
}

export interface AuthRequest extends Request {
  authUser?: AuthenticatedUser;
}

export function signSessionToken(payload: { uid: string; email: string }): string {
  const data = Buffer.from(
    JSON.stringify({
      uid: payload.uid,
      email: payload.email,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `mjh.${data}.${sig}`;
}

export function verifySessionToken(token: string): { uid: string; email: string } | null {
  if (!token.startsWith('mjh.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return { uid: parsed.uid, email: parsed.email };
  } catch {
    return null;
  }
}

export async function syncOrFetchUser(
  uid: string,
  email: string,
  name?: string,
  emailVerified = false
): Promise<AuthenticatedUser> {
  const cleanEmail = email.trim().toLowerCase();
  const isBootstrappedAdmin = DEFAULT_ADMIN_EMAILS.includes(cleanEmail);

  const upserted = await db
    .insert(users)
    .values({
      uid,
      email: cleanEmail,
      name: name?.trim() || cleanEmail.split('@')[0],
      role: isBootstrappedAdmin ? 'admin' : 'user',
      emailVerified,
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: {
        email: cleanEmail,
        emailVerified,
        updatedAt: new Date(),
      },
    })
    .returning();

  let userRow = upserted[0];

  await db
    .insert(userProfiles)
    .values({ userId: userRow.id })
    .onConflictDoNothing({ target: userProfiles.userId });

  if (isBootstrappedAdmin) {
    await db
      .insert(adminUsers)
      .values({
        userId: userRow.id,
        email: cleanEmail,
        role: 'SUPER_ADMIN',
      })
      .onConflictDoNothing({ target: adminUsers.userId });
  }

  const adminRecord = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.userId, userRow.id))
    .limit(1);

  const effectiveRole: 'user' | 'admin' =
    adminRecord.length > 0 || userRow.role === 'admin' || isBootstrappedAdmin ? 'admin' : 'user';

  if (effectiveRole === 'admin' && userRow.role !== 'admin') {
    const updated = await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.id, userRow.id))
      .returning();
    userRow = updated[0];
  }

  return {
    id: userRow.id,
    uid: userRow.uid,
    email: userRow.email,
    name: userRow.name,
    role: effectiveRole,
    isSuspended: userRow.isSuspended,
    emailVerified: userRow.emailVerified,
  };
}

async function resolveAuthFromRequest(req: AuthRequest): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  // 1. Check signed local session token first
  if (token.startsWith('mjh.')) {
    const verified = verifySessionToken(token);
    if (!verified) return null;
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.uid, verified.uid))
      .limit(1);
    if (!rows.length) return null;
    const u = rows[0];
    const adminRec = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.userId, u.id))
      .limit(1);
    const role: 'user' | 'admin' =
      adminRec.length > 0 || u.role === 'admin' || DEFAULT_ADMIN_EMAILS.includes(u.email.toLowerCase())
        ? 'admin'
        : 'user';
    return {
      id: u.id,
      uid: u.uid,
      email: u.email,
      name: u.name,
      role,
      isSuspended: u.isSuspended,
      emailVerified: u.emailVerified,
    };
  }

  // 2. Verify Firebase ID Token
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.email) return null;
    return await syncOrFetchUser(
      decoded.uid,
      decoded.email,
      decoded.name || decoded.email.split('@')[0],
      Boolean(decoded.email_verified)
    );
  } catch {
    return null;
  }
}

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const user = await resolveAuthFromRequest(req);
    if (user && !user.isSuspended) {
      req.authUser = user;
    }
  } catch {
    // ignore optional auth failure
  }
  next();
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await resolveAuthFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    if (user.isSuspended) {
      return res.status(403).json({ error: 'Your account is currently suspended. Contact support.' });
    }
    req.authUser = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.authUser) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator privileges required.' });
  }
  next();
};


export const requireSubscribed = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // public endpoints (home page stats)
    if (['/stats', '/categories', '/companies'].includes(req.path)) return next();
  if (req.path === '/' && Number(req.query.limit) > 0 && Number(req.query.limit) <= 6) return next();
  try {
    const user = await resolveAuthFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Please sign in.', code: 'LOGIN_REQUIRED' });
    if (user.isSuspended) return res.status(403).json({ error: 'Account suspended.' });
    req.authUser = user;
    if (user.role === 'admin') return next();
    const [row] = await db
      .select({ ok: users.youtubeSubscribed })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (!row?.ok) {
      return res
        .status(403)
        .json({ error: 'Subscribe to our YouTube channel to unlock jobs.', code: 'SUBSCRIBE_REQUIRED' });
    }
    next();
  } catch (err) {
    console.error('Subscribe gate error:', err);
    res.status(401).json({ error: 'Authentication failed.' });
  }
};
