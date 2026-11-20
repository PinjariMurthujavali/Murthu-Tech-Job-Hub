import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, eq, gt } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { notifications, userProfiles, users } from '../db/schema.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import {
  type AuthRequest,
  requireAuth,
  signSessionToken,
  syncOrFetchUser,
} from '../middleware/auth.ts';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration data' });
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const uid = `local_${crypto.randomUUID()}`;
    const defaultAdminEmails = (process.env.ADMIN_EMAILS || 'luckymurthu@gmail.com')
      .split(',')
      .map((s) => s.trim().toLowerCase());
    const role = defaultAdminEmails.includes(email) ? 'admin' : 'user';

    const [created] = await db
      .insert(users)
      .values({
        uid,
        email,
        name: parsed.data.name,
        passwordHash,
        role,
        emailVerified: true,
      })
      .returning();

    await db
      .insert(userProfiles)
      .values({ userId: created.id })
      .onConflictDoNothing({ target: userProfiles.userId });

    const token = signSessionToken({ uid: created.uid, email: created.email });

    res.status(201).json({
      token,
      user: {
        id: created.id,
        uid: created.uid,
        email: created.email,
        name: created.name,
        role: created.role,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Valid email and password are required.' });
    }

    const email = parsed.data.email.toLowerCase();
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!rows.length || !rows[0].passwordHash) {
      return res.status(401).json({
        error: 'Invalid credentials. If you signed up with Google, please use Continue with Google.',
      });
    }

    const user = rows[0];
    if (user.isSuspended) {
      return res.status(403).json({ error: 'This account has been suspended.' });
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash!);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signSessionToken({ uid: user.uid, email: user.email });
    res.json({
      token,
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body as { idToken?: string };
    if (!idToken) {
      return res.status(400).json({ error: 'Missing Firebase ID token.' });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded.email) {
      return res.status(400).json({ error: 'Google account did not provide an email address.' });
    }

    const synced = await syncOrFetchUser(
      decoded.uid,
      decoded.email,
      decoded.name || decoded.email.split('@')[0],
      Boolean(decoded.email_verified)
    );

    if (synced.isSuspended) {
      return res.status(403).json({ error: 'This account has been suspended.' });
    }

    res.json({ user: synced });
  } catch (err: any) {
    console.error('Google auth sync error:', err);
    res.status(401).json({ error: `Google auth failed: ${err?.message || 'unknown'}` });
  }
  
});

router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (rows.length && rows[0].passwordHash) {
      const rawToken = crypto.randomBytes(24).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await db
        .update(users)
        .set({
          resetToken: tokenHash,
          resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        })
        .where(eq(users.id, rows[0].id));
    }

    res.json({
      message:
        'If an email/password account exists for that address, a password reset instruction has been generated. Google Sign-In accounts can sign in directly via Google.',
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Unable to process password reset request.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const schema = z.object({
      token: z.string().min(10),
      password: z.string().min(8).max(128),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Valid token and password (min 8 chars) required.' });
    }

    const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
    const rows = await db
      .select()
      .from(users)
      .where(and(eq(users.resetToken, tokenHash), gt(users.resetTokenExpiresAt, new Date())))
      .limit(1);

    if (!rows.length) {
      return res.status(400).json({ error: 'Reset token is invalid or has expired.' });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await db
      .update(users)
      .set({
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, rows[0].id));

    res.json({ message: 'Password updated successfully. You may now sign in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const authUser = req.authUser!;
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, authUser.id))
      .limit(1);

    const unreadRows = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, authUser.id), eq(notifications.isRead, false)));

    res.json({
      user: authUser,
      profile: profile || null,
      unreadNotifications: unreadRows.length,
    });
  } catch (err) {
    console.error('Fetch me error:', err);
    res.status(500).json({ error: 'Failed to load user session.' });
  }
});

export default router;
