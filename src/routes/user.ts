import fs from 'node:fs';
import path from 'node:path';
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { db } from '../db/index.ts';
import {
  feedback,
  jobAlerts,
  jobReports,
  jobs,
  notifications,
  savedJobs,
  userProfiles,
  users,
  viewedJobs,
} from '../db/schema.ts';
import { type AuthRequest, requireAuth } from '../middleware/auth.ts';

const router = Router();
router.use(requireAuth);

const resumeDir = path.resolve(process.cwd(), 'uploads', 'resumes');
fs.mkdirSync(resumeDir, { recursive: true });

const resumeUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, resumeDir),
    filename: (req: AuthRequest, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ['.pdf', '.doc', '.docx'].includes(ext) ? ext : '.pdf';
      cb(null, `resume_u${req.authUser?.id || 0}_${Date.now()}${safeExt}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.get('/profile', async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

    res.json({ user, profile: profile || null });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

router.put('/profile', async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().trim().min(2).max(80).optional(),
      phone: z.string().trim().max(30).optional().nullable(),
      headline: z.string().trim().max(160).optional().nullable(),
      qualification: z.string().trim().max(120).optional().nullable(),
      experienceYears: z.string().trim().max(40).optional().nullable(),
      skills: z.array(z.string().trim().max(40)).max(30).optional(),
      preferredLocation: z.string().trim().max(120).optional().nullable(),
      preferredCategories: z.array(z.string().trim().max(80)).max(15).optional(),
      bio: z.string().trim().max(1200).optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid profile data' });
    }

    const user = req.authUser!;
    if (parsed.data.name) {
      await db
        .update(users)
        .set({ name: parsed.data.name, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }

    const [updated] = await db
      .insert(userProfiles)
      .values({
        userId: user.id,
        phone: parsed.data.phone ?? null,
        headline: parsed.data.headline ?? null,
        qualification: parsed.data.qualification ?? null,
        experienceYears: parsed.data.experienceYears ?? null,
        skills: parsed.data.skills ?? [],
        preferredLocation: parsed.data.preferredLocation ?? null,
        preferredCategories: parsed.data.preferredCategories ?? [],
        bio: parsed.data.bio ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          phone: parsed.data.phone ?? null,
          headline: parsed.data.headline ?? null,
          qualification: parsed.data.qualification ?? null,
          experienceYears: parsed.data.experienceYears ?? null,
          skills: parsed.data.skills ?? [],
          preferredLocation: parsed.data.preferredLocation ?? null,
          preferredCategories: parsed.data.preferredCategories ?? [],
          bio: parsed.data.bio ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json({ profile: updated });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

router.post('/resume', resumeUpload.single('resume'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a valid PDF, DOC, or DOCX resume (max 5MB).' });
    }
    const user = req.authUser!;
    const resumeUrl = `/uploads/resumes/${req.file.filename}`;

    const [updated] = await db
      .insert(userProfiles)
      .values({
        userId: user.id,
        resumeFilename: req.file.originalname,
        resumeUrl,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          resumeFilename: req.file.originalname,
          resumeUrl,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json({ profile: updated });
  } catch (err) {
    console.error('Resume upload error:', err);
    res.status(500).json({ error: 'Failed to upload resume.' });
  }
});

router.get('/saved-jobs', async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({
        savedId: savedJobs.id,
        savedAt: savedJobs.createdAt,
        job: jobs,
      })
      .from(savedJobs)
      .innerJoin(jobs, eq(savedJobs.jobId, jobs.id))
      .where(eq(savedJobs.userId, req.authUser!.id))
      .orderBy(desc(savedJobs.createdAt));

    res.json(rows.map((r) => ({ ...r.job, savedAt: r.savedAt })));
  } catch (err) {
    console.error('Saved jobs error:', err);
    res.status(500).json({ error: 'Failed to fetch saved jobs.' });
  }
});

router.post('/saved-jobs/:jobId', async (req: AuthRequest, res) => {
  try {
    const jobId = parseInt(String(req.params.jobId), 10);
    if (!jobId) return res.status(400).json({ error: 'Invalid job ID' });

    await db
      .insert(savedJobs)
      .values({ userId: req.authUser!.id, jobId })
      .onConflictDoNothing();

    res.status(201).json({ saved: true });
  } catch (err) {
    console.error('Save job error:', err);
    res.status(500).json({ error: 'Failed to save job.' });
  }
});

router.delete('/saved-jobs/:jobId', async (req: AuthRequest, res) => {
  try {
    const jobId = parseInt(String(req.params.jobId), 10);
    await db
      .delete(savedJobs)
      .where(and(eq(savedJobs.userId, req.authUser!.id), eq(savedJobs.jobId, jobId)));
    res.json({ saved: false });
  } catch (err) {
    console.error('Unsave job error:', err);
    res.status(500).json({ error: 'Failed to remove saved job.' });
  }
});

router.get('/viewed-jobs', async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({
        viewedAt: viewedJobs.viewedAt,
        job: jobs,
      })
      .from(viewedJobs)
      .innerJoin(jobs, eq(viewedJobs.jobId, jobs.id))
      .where(eq(viewedJobs.userId, req.authUser!.id))
      .orderBy(desc(viewedJobs.viewedAt))
      .limit(30);

    const seen = new Set<number>();
    const deduped = [];
    for (const r of rows) {
      if (seen.has(r.job.id)) continue;
      seen.add(r.job.id);
      deduped.push({ ...r.job, viewedAt: r.viewedAt });
    }
    res.json(deduped);
  } catch (err) {
    console.error('Viewed jobs error:', err);
    res.status(500).json({ error: 'Failed to load recently viewed jobs.' });
  }
});

router.get('/alerts', async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(jobAlerts)
      .where(eq(jobAlerts.userId, req.authUser!.id))
      .orderBy(desc(jobAlerts.createdAt));
    res.json(rows);
  } catch (err) {
    console.error('Alerts error:', err);
    res.status(500).json({ error: 'Failed to load job alerts.' });
  }
});

router.post('/alerts', async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      title: z.string().trim().min(2).max(120),
      keywords: z.string().trim().max(120).optional().nullable(),
      location: z.string().trim().max(100).optional().nullable(),
      category: z.string().trim().max(100).optional().nullable(),
      experienceLevel: z.string().trim().max(40).optional().nullable(),
      workMode: z.string().trim().max(30).optional().nullable(),
      sector: z.string().trim().max(30).optional().nullable(),
      emailEnabled: z.boolean().optional(),
      inAppEnabled: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid alert details.' });
    }

    const [created] = await db
      .insert(jobAlerts)
      .values({
        userId: req.authUser!.id,
        title: parsed.data.title,
        keywords: parsed.data.keywords || null,
        location: parsed.data.location || null,
        category: parsed.data.category || null,
        experienceLevel: parsed.data.experienceLevel || null,
        workMode: parsed.data.workMode || null,
        sector: parsed.data.sector || null,
        emailEnabled: parsed.data.emailEnabled ?? true,
        inAppEnabled: parsed.data.inAppEnabled ?? true,
      })
      .returning();

    res.status(201).json(created);
  } catch (err) {
    console.error('Create alert error:', err);
    res.status(500).json({ error: 'Failed to create job alert.' });
  }
});

router.patch('/alerts/:id', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const { isActive, emailEnabled, inAppEnabled } = req.body as {
      isActive?: boolean;
      emailEnabled?: boolean;
      inAppEnabled?: boolean;
    };

    const [updated] = await db
      .update(jobAlerts)
      .set({
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
        ...(typeof emailEnabled === 'boolean' ? { emailEnabled } : {}),
        ...(typeof inAppEnabled === 'boolean' ? { inAppEnabled } : {}),
      })
      .where(and(eq(jobAlerts.id, id), eq(jobAlerts.userId, req.authUser!.id)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Alert not found' });
    res.json(updated);
  } catch (err) {
    console.error('Update alert error:', err);
    res.status(500).json({ error: 'Failed to update job alert.' });
  }
});

router.delete('/alerts/:id', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await db
      .delete(jobAlerts)
      .where(and(eq(jobAlerts.id, id), eq(jobAlerts.userId, req.authUser!.id)));
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete alert error:', err);
    res.status(500).json({ error: 'Failed to delete job alert.' });
  }
});

router.get('/notifications', async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.authUser!.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    res.json(rows);
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

router.patch('/notifications/read-all', async (req: AuthRequest, res) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, req.authUser!.id));
    res.json({ ok: true });
  } catch (err) {
    console.error('Mark notifications error:', err);
    res.status(500).json({ error: 'Failed to mark notifications read.' });
  }
});

router.get('/activity', async (req: AuthRequest, res) => {
  try {
    const [reports, userFeedback] = await Promise.all([
      db
        .select({
          id: jobReports.id,
          jobId: jobReports.jobId,
          jobTitle: jobs.title,
          companyName: jobs.companyName,
          category: jobReports.category,
          description: jobReports.description,
          status: jobReports.status,
          adminNotes: jobReports.adminNotes,
          createdAt: jobReports.createdAt,
        })
        .from(jobReports)
        .innerJoin(jobs, eq(jobReports.jobId, jobs.id))
        .where(eq(jobReports.userId, req.authUser!.id))
        .orderBy(desc(jobReports.createdAt)),
      db
        .select()
        .from(feedback)
        .where(eq(feedback.userId, req.authUser!.id))
        .orderBy(desc(feedback.createdAt)),
    ]);

    res.json({ reports, feedback: userFeedback });
  } catch (err) {
    console.error('User activity error:', err);
    res.status(500).json({ error: 'Failed to fetch activity history.' });
  }
});

export default router;
