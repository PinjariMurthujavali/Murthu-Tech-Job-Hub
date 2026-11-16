import crypto from 'node:crypto';
import { asc, count, desc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.ts';
import {
  adminUsers,
  applicationClicks,
  companies,
  feedback,
  jobCategories,
  jobReports,
  jobs,
  jobSkills,
  jobSources,
  syncLogs,
  users,
  validationLogs,
} from '../db/schema.ts';
import { type AuthRequest, requireAdmin, requireAuth } from '../middleware/auth.ts';
import { schedulerState } from '../services/scheduler.ts';
import { computeJobFingerprint, slugify } from '../services/sources/normalize.ts';
import {
  syncAllEnabledSources,
  syncSerpApiCustomQuery,
  syncSingleSource,
} from '../services/syncEngine.ts';
import {
  runExpirySweep,
  runValidationBatch,
  validateSingleJob,
} from '../services/validationEngine.ts';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/overview', async (_req, res) => {
  try {
    const [
      [totalJobs],
      [liveJobs],
      [unverifiedJobs],
      [underReviewJobs],
      [closedJobs],
      [expiredJobs],
      [totalUsers],
      [totalCompanies],
      [totalClicks],
      [openReports],
      sources,
    ] = await Promise.all([
      db.select({ count: count() }).from(jobs).where(eq(jobs.isDeleted, false)),
      db
        .select({ count: count() })
        .from(jobs)
        .where(eq(jobs.verificationStatus, 'LIVE VERIFIED')),
      db
        .select({ count: count() })
        .from(jobs)
        .where(eq(jobs.verificationStatus, 'UNVERIFIED')),
      db
        .select({ count: count() })
        .from(jobs)
        .where(eq(jobs.verificationStatus, 'UNDER REVIEW')),
      db.select({ count: count() }).from(jobs).where(eq(jobs.verificationStatus, 'CLOSED')),
      db.select({ count: count() }).from(jobs).where(eq(jobs.verificationStatus, 'EXPIRED')),
      db.select({ count: count() }).from(users),
      db.select({ count: count() }).from(companies),
      db.select({ count: count() }).from(applicationClicks),
      db.select({ count: count() }).from(jobReports).where(eq(jobReports.status, 'OPEN')),
      db.select().from(jobSources).orderBy(asc(jobSources.id)),
    ]);

    res.json({
      stats: {
        totalJobs: Number(totalJobs.count),
        liveVerifiedJobs: Number(liveJobs.count),
        unverifiedJobs: Number(unverifiedJobs.count),
        underReviewJobs: Number(underReviewJobs.count),
        closedJobs: Number(closedJobs.count),
        expiredJobs: Number(expiredJobs.count),
        totalUsers: Number(totalUsers.count),
        totalCompanies: Number(totalCompanies.count),
        totalClicks: Number(totalClicks.count),
        openReports: Number(openReports.count),
      },
      sources,
      scheduler: schedulerState,
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Failed to load admin overview.' });
  }
});

// A. Job Management
router.get('/jobs', async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();
    const limit = Math.min(100, parseInt(String(req.query.limit || '40'), 10) || 40);
    const rows = status
      ? await db
          .select()
          .from(jobs)
          .where(eq(jobs.verificationStatus, status))
          .orderBy(desc(jobs.updatedAt))
          .limit(limit)
      : await db.select().from(jobs).orderBy(desc(jobs.updatedAt)).limit(limit);

    res.json(rows);
  } catch (err) {
    console.error('Admin jobs list error:', err);
    res.status(500).json({ error: 'Failed to fetch jobs.' });
  }
});

router.post('/jobs', async (req, res) => {
  try {
    const schema = z.object({
      title: z.string().trim().min(3).max(160),
      companyName: z.string().trim().min(2).max(120),
      categoryName: z.string().trim().min(2).max(100),
      description: z.string().trim().min(10).max(10000),
      qualifications: z.string().trim().max(500).optional(),
      location: z.string().trim().min(2).max(120),
      city: z.string().trim().max(80).optional(),
      state: z.string().trim().max(80).optional(),
      country: z.string().trim().max(80).default('India'),
      pincode: z.string().trim().max(12).optional(),
      workMode: z.enum(['Office', 'Remote', 'Hybrid']).default('Office'),
      employmentType: z
        .enum([
          'Full-time',
          'Part-time',
          'Internship',
          'Contract',
          'Freelance',
          'Apprenticeship',
          'Walk-in',
        ])
        .default('Full-time'),
      sector: z.enum(['Private', 'Government']).default('Private'),
      experienceLevel: z
        .enum(['Fresher', '0-1 Years', '1-3 Years', '3-5 Years', '5-10 Years', '10+ Years'])
        .default('1-3 Years'),
      salaryDisplay: z.string().trim().max(100).optional(),
      applyUrl: z.string().url(),
      skills: z.array(z.string().trim().max(40)).max(15).optional(),
      isFeatured: z.boolean().optional(),
      verificationStatus: z
        .enum(['LIVE VERIFIED', 'UNVERIFIED', 'UNDER REVIEW', 'CLOSED', 'EXPIRED', 'REMOVED'])
        .default('LIVE VERIFIED'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid job data' });
    }

    const d = parsed.data;
    const [directSrc] = await db
      .select()
      .from(jobSources)
      .where(eq(jobSources.slug, 'direct-employer'))
      .limit(1);

    if (!directSrc) {
      return res.status(500).json({ error: 'Direct source missing.' });
    }

    const companySlug = slugify(d.companyName);
    const [company] = await db
      .insert(companies)
      .values({ name: d.companyName, slug: companySlug, headquarters: d.city || d.location })
      .onConflictDoUpdate({ target: companies.slug, set: { name: d.companyName } })
      .returning();

    const [cat] = await db
      .select()
      .from(jobCategories)
      .where(eq(jobCategories.name, d.categoryName))
      .limit(1);

    const extId = `manual_${crypto.randomBytes(6).toString('hex')}`;
    const fingerprint = computeJobFingerprint(d.title, d.companyName, d.location);
    const jobSlug = `${slugify(`${d.title}-${d.companyName}`)}-${extId.slice(-6)}`;

    const [created] = await db
      .insert(jobs)
      .values({
        slug: jobSlug,
        sourceId: directSrc.id,
        sourceName: directSrc.name,
        externalJobId: extId,
        fingerprint,
        title: d.title,
        companyId: company.id,
        companyName: d.companyName,
        categoryId: cat?.id || null,
        categoryName: d.categoryName,
        description: d.description,
        qualifications: d.qualifications || null,
        location: d.location,
        city: d.city || null,
        state: d.state || null,
        country: d.country,
        pincode: d.pincode || null,
        workMode: d.workMode,
        employmentType: d.employmentType,
        sector: d.sector,
        experienceLevel: d.experienceLevel,
        salaryDisplay: d.salaryDisplay || null,
        applyUrl: d.applyUrl,
        verificationStatus: d.verificationStatus,
        lastVerifiedAt: d.verificationStatus === 'LIVE VERIFIED' ? new Date() : null,
        isFeatured: d.isFeatured ?? false,
        expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      })
      .returning();

    if (d.skills?.length) {
      await db.insert(jobSkills).values(
        d.skills.map((skillName) => ({ jobId: created.id, skillName }))
      );
    }

    res.status(201).json(created);
  } catch (err) {
    console.error('Admin create job error:', err);
    res.status(500).json({ error: 'Failed to create job.' });
  }
});

router.patch('/jobs/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const { verificationStatus, isFeatured, isDeleted, title, applyUrl, salaryDisplay } = req.body as {
      verificationStatus?: string;
      isFeatured?: boolean;
      isDeleted?: boolean;
      title?: string;
      applyUrl?: string;
      salaryDisplay?: string;
    };

    const [updated] = await db
      .update(jobs)
      .set({
        ...(verificationStatus ? { verificationStatus } : {}),
        ...(verificationStatus === 'LIVE VERIFIED' ? { lastVerifiedAt: new Date() } : {}),
        ...(typeof isFeatured === 'boolean' ? { isFeatured } : {}),
        ...(typeof isDeleted === 'boolean' ? { isDeleted } : {}),
        ...(title ? { title } : {}),
        ...(applyUrl ? { applyUrl } : {}),
        ...(typeof salaryDisplay === 'string' ? { salaryDisplay } : {}),
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Job not found' });
    res.json(updated);
  } catch (err) {
    console.error('Admin update job error:', err);
    res.status(500).json({ error: 'Failed to update job.' });
  }
});

router.post('/jobs/:id/validate', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const result = await validateSingleJob(id);
    res.json(result);
  } catch (err) {
    console.error('Manual single validation error:', err);
    res.status(500).json({ error: 'Failed to validate job URL.' });
  }
});

// B. Source Management & Sync
router.get('/sources', async (_req, res) => {
  try {
    const sources = await db.select().from(jobSources).orderBy(asc(jobSources.id));
    res.json(sources);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load sources.' });
  }
});

router.patch('/sources/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const { isEnabled } = req.body as { isEnabled?: boolean };
    const [updated] = await db
      .update(jobSources)
      .set({ isEnabled: Boolean(isEnabled), updatedAt: new Date() })
      .where(eq(jobSources.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update source.' });
  }
});

router.post('/sources/:slug/sync', async (req, res) => {
  try {
    const result = await syncSingleSource(String(req.params.slug));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Source sync failed.' });
  }
});

router.post('/sync-all', async (_req, res) => {
  try {
    const results = await syncAllEnabledSources();
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Full sync failed.' });
  }
});

router.post('/serpapi-search', async (req, res) => {
  try {
    const query = String(req.body?.query || '').trim();
    const location = String(req.body?.location || 'Hyderabad, Telangana, India').trim();
    if (!query) return res.status(400).json({ error: 'Query is required.' });
    const result = await syncSerpApiCustomQuery(query, location);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'SerpApi search failed.' });
  }
});

router.post('/validate-batch', async (_req, res) => {
  try {
    const expiredCount = await runExpirySweep();
    const results = await runValidationBatch(20);
    res.json({ expiredCount, checked: results.length, results });
  } catch (err) {
    res.status(500).json({ error: 'Batch validation failed.' });
  }
});

// C. Reports & Feedback Management
router.get('/reports', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: jobReports.id,
        jobId: jobReports.jobId,
        jobTitle: jobs.title,
        companyName: jobs.companyName,
        jobStatus: jobs.verificationStatus,
        applyUrl: jobs.applyUrl,
        reporterEmail: jobReports.reporterEmail,
        category: jobReports.category,
        description: jobReports.description,
        evidenceUrl: jobReports.evidenceUrl,
        status: jobReports.status,
        adminNotes: jobReports.adminNotes,
        createdAt: jobReports.createdAt,
      })
      .from(jobReports)
      .innerJoin(jobs, eq(jobReports.jobId, jobs.id))
      .orderBy(desc(jobReports.createdAt))
      .limit(80);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load reports.' });
  }
});

router.patch('/reports/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const { status, adminNotes, newJobStatus } = req.body as {
      status?: string;
      adminNotes?: string;
      newJobStatus?: string;
    };

    const [updated] = await db
      .update(jobReports)
      .set({
        ...(status ? { status } : {}),
        ...(typeof adminNotes === 'string' ? { adminNotes } : {}),
        ...(status === 'RESOLVED' || status === 'DISMISSED' ? { resolvedAt: new Date() } : {}),
      })
      .where(eq(jobReports.id, id))
      .returning();

    if (updated && newJobStatus) {
      await db
        .update(jobs)
        .set({ verificationStatus: newJobStatus, updatedAt: new Date() })
        .where(eq(jobs.id, updated.jobId));
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update report.' });
  }
});

router.get('/feedback', async (_req, res) => {
  try {
    const rows = await db.select().from(feedback).orderBy(desc(feedback.createdAt)).limit(80);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load feedback.' });
  }
});

router.patch('/feedback/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const { status, adminResponse } = req.body as { status?: string; adminResponse?: string };
    const [updated] = await db
      .update(feedback)
      .set({
        ...(status ? { status } : {}),
        ...(typeof adminResponse === 'string' ? { adminResponse } : {}),
      })
      .where(eq(feedback.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update feedback.' });
  }
});

// D. Category Management
router.post('/categories', async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().trim().min(2).max(80),
      groupName: z.string().trim().min(2).max(80),
      description: z.string().trim().max(300).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid category payload' });
    }
    const [created] = await db
      .insert(jobCategories)
      .values({
        name: parsed.data.name,
        slug: slugify(parsed.data.name),
        groupName: parsed.data.groupName,
        description: parsed.data.description || null,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create category.' });
  }
});

router.patch('/categories/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const { name, groupName, description } = req.body as {
      name?: string;
      groupName?: string;
      description?: string;
    };
    const [updated] = await db
      .update(jobCategories)
      .set({
        ...(name ? { name, slug: slugify(name) } : {}),
        ...(groupName ? { groupName } : {}),
        ...(typeof description === 'string' ? { description } : {}),
      })
      .where(eq(jobCategories.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update category.' });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await db.delete(jobCategories).where(eq(jobCategories.id, id));
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete category (may be in use by jobs).' });
  }
});

// E. User Management
router.get('/users', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: users.id,
        uid: users.uid,
        email: users.email,
        name: users.name,
        role: users.role,
        isSuspended: users.isSuspended,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(100);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

router.patch('/users/:id', async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (id === req.authUser?.id) {
      return res.status(400).json({ error: 'Cannot modify your own admin status/suspension.' });
    }
    const { isSuspended, role } = req.body as { isSuspended?: boolean; role?: 'user' | 'admin' };
    const [updated] = await db
      .update(users)
      .set({
        ...(typeof isSuspended === 'boolean' ? { isSuspended } : {}),
        ...(role === 'user' || role === 'admin' ? { role } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isSuspended: users.isSuspended,
      });

    if (updated && role === 'admin') {
      await db
        .insert(adminUsers)
        .values({ userId: updated.id, email: updated.email, role: 'MODERATOR' })
        .onConflictDoNothing();
    } else if (updated && role === 'user') {
      await db.delete(adminUsers).where(eq(adminUsers.userId, updated.id));
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// F. System Monitoring
router.get('/logs', async (_req, res) => {
  try {
    const [recentSyncs, recentValidations, dbHealth] = await Promise.all([
      db.select().from(syncLogs).orderBy(desc(syncLogs.createdAt)).limit(30),
      db
        .select({
          id: validationLogs.id,
          jobId: validationLogs.jobId,
          jobTitle: jobs.title,
          previousStatus: validationLogs.previousStatus,
          newStatus: validationLogs.newStatus,
          httpStatus: validationLogs.httpStatus,
          checkOutcome: validationLogs.checkOutcome,
          details: validationLogs.details,
          checkedAt: validationLogs.checkedAt,
        })
        .from(validationLogs)
        .innerJoin(jobs, eq(validationLogs.jobId, jobs.id))
        .orderBy(desc(validationLogs.checkedAt))
        .limit(40),
      db.execute(sql`SELECT NOW() AS server_time, current_database() AS db_name`),
    ]);

    res.json({
      syncLogs: recentSyncs,
      validationLogs: recentValidations,
      scheduler: schedulerState,
      database: dbHealth.rows?.[0] || { ok: true },
    });
  } catch (err) {
    console.error('Admin logs error:', err);
    res.status(500).json({ error: 'Failed to load system logs.' });
  }
});

export default router;
