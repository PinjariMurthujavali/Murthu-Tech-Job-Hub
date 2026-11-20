import fs from 'node:fs';
import path from 'node:path';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  or,
  sql,
} from 'drizzle-orm';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { db } from '../db/index.ts';
import {
  applicationClicks,
  companies,
  jobCategories,
  jobReports,
  jobs,
  jobSkills,
  jobSources,
  validationLogs,
  viewedJobs,
} from '../db/schema.ts';
import { type AuthRequest, optionalAuth } from '../middleware/auth.ts';
import { validateSingleJob } from '../services/validationEngine.ts';

const router = Router();

// "Hyderabad" search should also match nearby areas and "Hyderabad, Telangana" style text
const HYDERABAD_ALIASES = [
  'hyderabad',
  'secunderabad',
  'telangana',
  'hitech',
  'hi-tech',
  'gachibowli',
  'madhapur',
  'kondapur',
  'kukatpally',
  'ameerpet',
  'banjara',
  'uppal',
  'begumpet',
  'hyd',
];

function locationPatterns(raw: string): string[] {
  const base = raw.split(',')[0].trim().toLowerCase();
  if (!base) return [];
  if (HYDERABAD_ALIASES.some((a) => base.includes(a))) {
    return HYDERABAD_ALIASES.map((a) => `%${a}%`);
  }
  return [`%${base}%`];
}

const evidenceDir = path.resolve(process.cwd(), 'uploads', 'evidence');
fs.mkdirSync(evidenceDir, { recursive: true });

const evidenceUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, evidenceDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.png';
      cb(null, `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${safeExt}`);
    },
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const ACTIVE_STATUSES = ['LIVE VERIFIED', 'UNVERIFIED', 'UNDER REVIEW'];

router.get('/', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const category = String(req.query.category || '').trim();
    const location = String(req.query.location || '').trim();
    const city = String(req.query.city || '').trim();
    const state = String(req.query.state || '').trim();
    const pincode = String(req.query.pincode || '').trim();
    const qualification = String(req.query.qualification || '').trim();
    const experienceLevel = String(req.query.experienceLevel || '').trim();
    const employmentType = String(req.query.employmentType || '').trim();
    const workMode = String(req.query.workMode || '').trim();
    const sector = String(req.query.sector || '').trim();
    const source = String(req.query.source || '').trim();
    const status = String(req.query.status || '').trim();
    const salaryMin = parseInt(String(req.query.salaryMin || '0'), 10) || 0;
    const postedWithinDays = parseInt(String(req.query.postedWithinDays || '0'), 10) || 0;
    const sort = String(req.query.sort || 'latest');
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '18'), 10) || 18));
    const offset = (page - 1) * limit;

    const conditions = [eq(jobs.isDeleted, false)];

    if (status && ACTIVE_STATUSES.includes(status)) {
      conditions.push(eq(jobs.verificationStatus, status));
    } else {
      // Closed, expired, and removed jobs disappear from active search results
      conditions.push(inArray(jobs.verificationStatus, ACTIVE_STATUSES));
    }

    if (q) {
      const pattern = `%${q}%`;
      const matchingJobIds = await db
        .select({ jobId: jobSkills.jobId })
        .from(jobSkills)
        .where(ilike(jobSkills.skillName, pattern));

      const ids = matchingJobIds.map((r) => r.jobId);
      if (ids.length > 0) {
        conditions.push(
          or(
            ilike(jobs.title, pattern),
            ilike(jobs.companyName, pattern),
            ilike(jobs.categoryName, pattern),
            ilike(jobs.description, pattern),
            inArray(jobs.id, ids)
          )!
        );
      } else {
        conditions.push(
          or(
            ilike(jobs.title, pattern),
            ilike(jobs.companyName, pattern),
            ilike(jobs.categoryName, pattern),
            ilike(jobs.description, pattern)
          )!
        );
      }
    }

    if (category) {
      conditions.push(ilike(jobs.categoryName, `%${category}%`));
    }
    if (location) {
      const pats = locationPatterns(location);
      if (pats.length) {
        const parts = pats.flatMap((p) => [
          ilike(jobs.location, p),
          ilike(jobs.city, p),
          ilike(jobs.state, p),
        ]);
        conditions.push(or(...parts)!);
      }
    }
    if (city) {
      if (city.toLowerCase() === 'international') {
        conditions.push(sql`${jobs.country} <> 'India'`);
      } else {
        const pats = locationPatterns(city);
        const parts = pats.flatMap((p) => [ilike(jobs.city, p), ilike(jobs.location, p)]);
        conditions.push(or(...parts)!);
      }
    }
    if (state) {
      conditions.push(ilike(jobs.state, `%${state}%`));
    }
    if (pincode) {
      conditions.push(eq(jobs.pincode, pincode));
    }
    if (qualification) {
      conditions.push(
        or(
          ilike(jobs.qualifications, `%${qualification}%`),
          ilike(jobs.description, `%${qualification}%`)
        )!
      );
    }
    if (experienceLevel) {
      conditions.push(eq(jobs.experienceLevel, experienceLevel));
    }
    if (employmentType) {
      conditions.push(eq(jobs.employmentType, employmentType));
    }
    if (workMode) {
      conditions.push(eq(jobs.workMode, workMode));
    }
    if (sector) {
      conditions.push(eq(jobs.sector, sector));
    }
    if (source) {
      conditions.push(ilike(jobs.sourceName, `%${source}%`));
    }
    if (salaryMin > 0) {
      conditions.push(gte(jobs.salaryMax, salaryMin));
    }
    if (postedWithinDays > 0) {
      const since = new Date(Date.now() - postedWithinDays * 24 * 60 * 60 * 1000);
      conditions.push(gte(jobs.postedAt, since));
    }

    const whereClause = and(...conditions);

    let orderByClause = [desc(jobs.isFeatured), desc(jobs.postedAt)];
    if (sort === 'salary') {
      orderByClause = [desc(sql`COALESCE(${jobs.salaryMax}, 0)`), desc(jobs.postedAt)];
    } else if (sort === 'verified') {
      orderByClause = [
        desc(sql`CASE WHEN ${jobs.verificationStatus} = 'LIVE VERIFIED' THEN 1 ELSE 0 END`),
        desc(sql`COALESCE(${jobs.lastVerifiedAt}, ${jobs.postedAt})`),
      ];
    } else if (sort === 'relevant') {
      orderByClause = [
        desc(sql`CASE WHEN ${jobs.verificationStatus} = 'LIVE VERIFIED' THEN 1 ELSE 0 END`),
        desc(jobs.clickCount),
        desc(jobs.postedAt),
      ];
    }

    const [{ total }] = await db.select({ total: count() }).from(jobs).where(whereClause);

    const rows = await db
      .select()
      .from(jobs)
      .where(whereClause)
      .orderBy(...orderByClause)
      .limit(limit)
      .offset(offset);

    // Fetch skills in a single batched query
    const jobIds = rows.map((r) => r.id);
    const skillRows =
      jobIds.length > 0
        ? await db.select().from(jobSkills).where(inArray(jobSkills.jobId, jobIds))
        : [];

    const skillsMap = new Map<number, string[]>();
    for (const s of skillRows) {
      const list = skillsMap.get(s.jobId) || [];
      list.push(s.skillName);
      skillsMap.set(s.jobId, list);
    }

    const items = rows.map((row) => ({
      ...row,
      skills: skillsMap.get(row.id) || [],
    }));

    res.json({
      items,
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.max(1, Math.ceil(Number(total) / limit)),
      },
    });
  } catch (err) {
    console.error('Job search error:', err);
    res.status(500).json({ error: 'Failed to search jobs.' });
  }
});

router.get('/stats', async (_req, res) => {
  try {
    const activeWhere = and(
      eq(jobs.isDeleted, false),
      inArray(jobs.verificationStatus, ACTIVE_STATUSES)
    );

    const [[verifiedRow], [activeRow], [companiesRow], [categoriesRow], [sourcesRow], [hydRow], [fresherRow], [govtRow], [remoteRow], [internRow], [partTimeRow]] =
      await Promise.all([
        db
          .select({ count: count() })
          .from(jobs)
          .where(and(eq(jobs.isDeleted, false), eq(jobs.verificationStatus, 'LIVE VERIFIED'))),
        db.select({ count: count() }).from(jobs).where(activeWhere),
        db.select({ count: count() }).from(companies),
        db.select({ count: count() }).from(jobCategories),
        db.select({ count: count() }).from(jobSources).where(eq(jobSources.status, 'ACTIVE')),
        db
          .select({ count: count() })
          .from(jobs)
          .where(
            and(
              activeWhere,
              or(
                ...HYDERABAD_ALIASES.flatMap((a) => [
                  ilike(jobs.city, `%${a}%`),
                  ilike(jobs.location, `%${a}%`),
                ])
              )!
            )
          ),
        db
          .select({ count: count() })
          .from(jobs)
          .where(and(activeWhere, eq(jobs.experienceLevel, 'Fresher'))),
        db
          .select({ count: count() })
          .from(jobs)
          .where(and(activeWhere, eq(jobs.sector, 'Government'))),
        db
          .select({ count: count() })
          .from(jobs)
          .where(and(activeWhere, eq(jobs.workMode, 'Remote'))),
        db
          .select({ count: count() })
          .from(jobs)
          .where(and(activeWhere, eq(jobs.employmentType, 'Internship'))),
        db
          .select({ count: count() })
          .from(jobs)
          .where(and(activeWhere, eq(jobs.employmentType, 'Part-time'))),
      ]);

    res.json({
      liveVerifiedJobs: Number(verifiedRow.count),
      activeJobs: Number(activeRow.count),
      hiringCompanies: Number(companiesRow.count),
      jobCategories: Number(categoriesRow.count),
      activeSources: Number(sourcesRow.count),
      hyderabadJobs: Number(hydRow.count),
      fresherJobs: Number(fresherRow.count),
      governmentJobs: Number(govtRow.count),
      remoteJobs: Number(remoteRow.count),
      internshipJobs: Number(internRow.count),
      partTimeJobs: Number(partTimeRow.count),
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to load portal statistics.' });
  }
});

router.get('/categories', async (_req, res) => {
  try {
    const categories = await db
      .select()
      .from(jobCategories)
      .orderBy(asc(jobCategories.sortOrder), asc(jobCategories.name));

    const counts = await db
      .select({
        categoryName: jobs.categoryName,
        total: count(),
      })
      .from(jobs)
      .where(and(eq(jobs.isDeleted, false), inArray(jobs.verificationStatus, ACTIVE_STATUSES)))
      .groupBy(jobs.categoryName);

    const countMap = new Map(counts.map((c) => [c.categoryName.toLowerCase(), Number(c.total)]));

    res.json(
      categories.map((cat) => ({
        ...cat,
        activeCount: countMap.get(cat.name.toLowerCase()) || 0,
      }))
    );
  } catch (err) {
    console.error('Categories error:', err);
    res.status(500).json({ error: 'Failed to load categories.' });
  }
});

router.get('/companies', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        logoUrl: companies.logoUrl,
        headquarters: companies.headquarters,
        activeJobs: count(jobs.id),
      })
      .from(companies)
      .innerJoin(
        jobs,
        and(
          eq(jobs.companyId, companies.id),
          eq(jobs.isDeleted, false),
          inArray(jobs.verificationStatus, ACTIVE_STATUSES)
        )
      )
      .groupBy(companies.id)
      .orderBy(desc(count(jobs.id)))
      .limit(24);

    res.json(
      rows.map((r) => ({
        ...r,
        activeJobs: Number(r.activeJobs),
      }))
    );
  } catch (err) {
    console.error('Companies error:', err);
    res.status(500).json({ error: 'Failed to load hiring companies.' });
  }
});

router.get('/:idOrSlug', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const param = String(req.params.idOrSlug);
    const numericId = /^\d+$/.test(param) ? parseInt(param, 10) : null;

    const rows = await db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.isDeleted, false),
          numericId ? eq(jobs.id, numericId) : eq(jobs.slug, param)
        )
      )
      .limit(1);

    if (!rows.length) {
      return res.status(404).json({ error: 'Job listing not found.' });
    }

    const job = rows[0];
    const [skills, logs, related] = await Promise.all([
      db.select().from(jobSkills).where(eq(jobSkills.jobId, job.id)),
      db
        .select()
        .from(validationLogs)
        .where(eq(validationLogs.jobId, job.id))
        .orderBy(desc(validationLogs.checkedAt))
        .limit(5),
      db
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.isDeleted, false),
            eq(jobs.categoryName, job.categoryName),
            inArray(jobs.verificationStatus, ACTIVE_STATUSES),
            sql`${jobs.id} <> ${job.id}`
          )
        )
        .orderBy(desc(jobs.postedAt))
        .limit(4),
    ]);

    if (req.authUser) {
      await db.insert(viewedJobs).values({
        userId: req.authUser.id,
        jobId: job.id,
      });
    }

    res.json({
      ...job,
      skills: skills.map((s) => s.skillName),
      validationHistory: logs,
      relatedJobs: related,
    });
  } catch (err) {
    console.error('Job detail error:', err);
    res.status(500).json({ error: 'Failed to load job details.' });
  }
});

router.post('/:id/click', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const jobId = parseInt(String(req.params.id), 10);
    if (!jobId) return res.status(400).json({ error: 'Invalid job ID' });

    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    await db.insert(applicationClicks).values({
      jobId: job.id,
      userId: req.authUser?.id || null,
      sourceName: job.sourceName,
      referrer: String(req.headers.referer || '').slice(0, 255) || null,
    });

    await db
      .update(jobs)
      .set({ clickCount: job.clickCount + 1 })
      .where(eq(jobs.id, job.id));

    res.json({
      applyUrl: job.applyUrl,
      sourceName: job.sourceName,
      verificationStatus: job.verificationStatus,
    });
  } catch (err) {
    console.error('Apply click error:', err);
    res.status(500).json({ error: 'Failed to process apply link.' });
  }
});

router.post(
  '/:id/report',
  optionalAuth,
  evidenceUpload.single('evidence'),
  async (req: AuthRequest, res) => {
    try {
      const jobId = parseInt(String(req.params.id), 10);
      if (!jobId) return res.status(400).json({ error: 'Invalid job ID' });

      const schema = z.object({
        category: z.string().trim().min(2).max(80),
        description: z.string().trim().min(5).max(1500),
        reporterEmail: z.string().trim().email().optional().or(z.literal('')),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: parsed.error.issues[0]?.message || 'Invalid report payload' });
      }

      const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const evidenceUrl = req.file ? `/uploads/evidence/${req.file.filename}` : null;

      const [report] = await db
        .insert(jobReports)
        .values({
          jobId: job.id,
          userId: req.authUser?.id || null,
          reporterEmail: parsed.data.reporterEmail || req.authUser?.email || null,
          category: parsed.data.category,
          description: parsed.data.description,
          evidenceUrl,
          status: 'OPEN',
        })
        .returning();

      const nextReports = job.reportCount + 1;
      const nextStatus =
        nextReports >= 2 && job.verificationStatus !== 'CLOSED'
          ? 'UNDER REVIEW'
          : job.verificationStatus;

      await db
        .update(jobs)
        .set({
          reportCount: nextReports,
          validationPriority: job.validationPriority + 10,
          verificationStatus: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, job.id));

      // Trigger asynchronous live revalidation check immediately
      validateSingleJob(job.id).catch(() => {});

      res.status(201).json({
        report,
        message: 'Thank you. Your report has been logged and prioritized for live verification.',
      });
    } catch (err) {
      console.error('Job report error:', err);
      res.status(500).json({ error: 'Failed to submit report.' });
    }
  }
);

export default router;