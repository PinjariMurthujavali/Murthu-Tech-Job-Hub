import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  companies,
  jobCategories,
  jobs,
  jobSkills,
  jobSources,
  syncLogs,
} from '../db/schema.ts';
import { matchJobsToAlerts, type AlertMatchCandidate } from './alertEngine.ts';
import { adzunaIndiaAdapter } from './sources/adzunaIndia.ts';
import { arbeitnowAdapter } from './sources/arbeitnow.ts';
import { jobicyAdapter } from './sources/jobicy.ts';
import { computeJobFingerprint, inferCategoryName, slugify } from './sources/normalize.ts';
import { remotiveAdapter } from './sources/remotive.ts';
import { fetchSerpApiQuery, serpApiGoogleJobsAdapter } from './sources/serpapiGoogleJobs.ts';
import { themuseAdapter } from './sources/themuse.ts';
import type { JobSourceAdapter, NormalizedJobInput } from './sources/types.ts';

const ADAPTER_REGISTRY: JobSourceAdapter[] = [
  serpApiGoogleJobsAdapter,
  remotiveAdapter,
  arbeitnowAdapter,
  jobicyAdapter,
  themuseAdapter,
  adzunaIndiaAdapter,
];

export function getAdapterBySlug(slug: string): JobSourceAdapter | undefined {
  return ADAPTER_REGISTRY.find((a) => a.slug === slug);
}

export async function ingestNormalizedJobs(
  sourceId: number,
  sourceName: string,
  items: NormalizedJobInput[],
  initialStatus: 'LIVE VERIFIED' | 'UNVERIFIED' = 'UNVERIFIED'
): Promise<{ inserted: number; duplicates: number; insertedCandidates: AlertMatchCandidate[] }> {
  const categories = await db.select().from(jobCategories);
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

  let inserted = 0;
  let duplicates = 0;
  const insertedCandidates: AlertMatchCandidate[] = [];

  for (const item of items) {
    try {
      const fingerprint = computeJobFingerprint(item.title, item.companyName, item.location);
      const companySlug = slugify(item.companyName) || `company-${crypto.randomBytes(3).toString('hex')}`;

      const companyRow = await db
        .insert(companies)
        .values({
          name: item.companyName,
          slug: companySlug,
          website: item.companyWebsite || null,
          logoUrl: item.companyLogoUrl || null,
          headquarters: item.city || item.location,
        })
        .onConflictDoUpdate({
          target: companies.slug,
          set: {
            logoUrl: item.companyLogoUrl || undefined,
          },
        })
        .returning();

      const resolvedCategoryName = inferCategoryName(
        item.title,
        item.rawCategory || '',
        item.description
      );
      const catMatch =
        categoryByName.get(resolvedCategoryName.toLowerCase()) ||
        categoryByName.get('software developer');

      const baseSlug = slugify(`${item.title}-${item.companyName}`);
      const uniqueSuffix = crypto.createHash('md5').update(`${sourceName}:${item.externalJobId}`).digest('hex').slice(0, 6);
      const jobSlug = `${baseSlug}-${uniqueSuffix}`;

      const expiresAt =
        item.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const result = await db
        .insert(jobs)
        .values({
          slug: jobSlug,
          sourceId,
          sourceName,
          externalJobId: item.externalJobId,
          fingerprint,
          title: item.title,
          companyId: companyRow[0]?.id || null,
          companyName: item.companyName,
          categoryId: catMatch?.id || null,
          categoryName: catMatch?.name || resolvedCategoryName,
          description: item.description,
          qualifications: item.qualifications || null,
          location: item.location,
          city: item.city || null,
          state: item.state || null,
          country: item.country || 'India',
          pincode: item.pincode || null,
          workMode: item.workMode,
          employmentType: item.employmentType,
          sector: item.sector,
          experienceLevel: item.experienceLevel,
          experienceMin: item.experienceMin,
          experienceMax: item.experienceMax,
          salaryMin: item.salaryMin || null,
          salaryMax: item.salaryMax || null,
          salaryCurrency: item.salaryCurrency || 'INR',
          salaryDisplay: item.salaryDisplay || null,
          applyUrl: item.applyUrl,
          verificationStatus: initialStatus,
          lastVerifiedAt: initialStatus === 'LIVE VERIFIED' ? new Date() : null,
          postedAt: item.postedAt || new Date(),
          expiresAt,
        })
        .onConflictDoNothing()
        .returning();

      if (result.length === 0) {
        duplicates++;
        continue;
      }

      const createdJob = result[0];
      inserted++;

      if (item.skills.length > 0) {
        await db.insert(jobSkills).values(
          item.skills.slice(0, 10).map((skill) => ({
            jobId: createdJob.id,
            skillName: skill,
          }))
        );
      }

      insertedCandidates.push({
        id: createdJob.id,
        title: createdJob.title,
        companyName: createdJob.companyName,
        categoryName: createdJob.categoryName,
        location: createdJob.location,
        city: createdJob.city,
        experienceLevel: createdJob.experienceLevel,
        workMode: createdJob.workMode,
        sector: createdJob.sector,
      });
    } catch {
      duplicates++;
    }
  }

  if (insertedCandidates.length > 0) {
    await matchJobsToAlerts(insertedCandidates);
  }

  return { inserted, duplicates, insertedCandidates };
}

export async function syncSingleSource(sourceSlug: string): Promise<{
  status: string;
  fetched: number;
  inserted: number;
  duplicates: number;
  error?: string;
}> {
  const start = Date.now();
  const sourceRows = await db
    .select()
    .from(jobSources)
    .where(eq(jobSources.slug, sourceSlug))
    .limit(1);

  if (!sourceRows.length) {
    return { status: 'FAILED', fetched: 0, inserted: 0, duplicates: 0, error: 'Source not found' };
  }

  const source = sourceRows[0];
  const adapter = getAdapterBySlug(sourceSlug);

  if (!source.isEnabled) {
    return { status: 'SKIPPED', fetched: 0, inserted: 0, duplicates: 0, error: 'Source disabled' };
  }

  if (!adapter || !adapter.isConfigured()) {
    const msg =
      adapter && !adapter.isConfigured()
        ? 'API key not configured in environment.'
        : 'No automated API adapter for this source.';
    await db
      .update(jobSources)
      .set({
        status: adapter ? 'AWAITING_API_KEY' : 'UNAVAILABLE',
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(jobSources.id, source.id));

    return { status: 'SKIPPED', fetched: 0, inserted: 0, duplicates: 0, error: msg };
  }

  const fetchResult = await adapter.fetchJobs();
  const durationMs = Date.now() - start;

  if (fetchResult.error && fetchResult.jobs.length === 0) {
    await db
      .update(jobSources)
      .set({
        status: 'ERROR',
        lastSyncAt: new Date(),
        lastError: fetchResult.error,
        updatedAt: new Date(),
      })
      .where(eq(jobSources.id, source.id));

    await db.insert(syncLogs).values({
      sourceId: source.id,
      sourceName: source.name,
      status: 'FAILED',
      jobsFetched: 0,
      jobsInserted: 0,
      duplicatesSkipped: 0,
      errorMessage: fetchResult.error,
      durationMs,
    });

    return {
      status: 'FAILED',
      fetched: 0,
      inserted: 0,
      duplicates: 0,
      error: fetchResult.error,
    };
  }

  const { inserted, duplicates } = await ingestNormalizedJobs(
    source.id,
    source.name,
    fetchResult.jobs,
    'UNVERIFIED'
  );

  await db
    .update(jobSources)
    .set({
      status: 'ACTIVE',
      lastSyncAt: new Date(),
      lastSuccessAt: new Date(),
      lastError: fetchResult.error || null,
      jobsImportedCount: source.jobsImportedCount + inserted,
      updatedAt: new Date(),
    })
    .where(eq(jobSources.id, source.id));

  await db.insert(syncLogs).values({
    sourceId: source.id,
    sourceName: source.name,
    status: fetchResult.error ? 'PARTIAL' : 'SUCCESS',
    jobsFetched: fetchResult.jobs.length,
    jobsInserted: inserted,
    duplicatesSkipped: duplicates,
    errorMessage: fetchResult.error || null,
    durationMs: Date.now() - start,
  });

  return {
    status: 'SUCCESS',
    fetched: fetchResult.jobs.length,
    inserted,
    duplicates,
  };
}

export async function syncSerpApiCustomQuery(query: string, location: string) {
  const sourceRows = await db
    .select()
    .from(jobSources)
    .where(eq(jobSources.slug, 'serpapi-google-jobs'))
    .limit(1);

  if (!sourceRows.length) {
    throw new Error('SerpApi Google Jobs source record missing');
  }
  const source = sourceRows[0];
  const start = Date.now();
  const result = await fetchSerpApiQuery(query, location);

  if (result.error && !result.jobs.length) {
    await db.insert(syncLogs).values({
      sourceId: source.id,
      sourceName: source.name,
      status: 'FAILED',
      jobsFetched: 0,
      jobsInserted: 0,
      duplicatesSkipped: 0,
      errorMessage: result.error,
      durationMs: Date.now() - start,
    });
    return { status: 'FAILED', fetched: 0, inserted: 0, duplicates: 0, error: result.error };
  }

  const { inserted, duplicates } = await ingestNormalizedJobs(
    source.id,
    source.name,
    result.jobs,
    'UNVERIFIED'
  );

  await db
    .update(jobSources)
    .set({
      status: 'ACTIVE',
      lastSyncAt: new Date(),
      lastSuccessAt: new Date(),
      jobsImportedCount: source.jobsImportedCount + inserted,
      updatedAt: new Date(),
    })
    .where(eq(jobSources.id, source.id));

  await db.insert(syncLogs).values({
    sourceId: source.id,
    sourceName: source.name,
    status: 'SUCCESS',
    jobsFetched: result.jobs.length,
    jobsInserted: inserted,
    duplicatesSkipped: duplicates,
    durationMs: Date.now() - start,
  });

  return {
    status: 'SUCCESS',
    fetched: result.jobs.length,
    inserted,
    duplicates,
  };
}

export async function syncAllEnabledSources() {
  const sources = await db.select().from(jobSources);
  const summary: Array<{ slug: string; status: string; inserted: number; fetched: number; error?: string }> = [];

  for (const s of sources) {
    if (!s.isEnabled) continue;
    const adapter = getAdapterBySlug(s.slug);
    if (!adapter || !adapter.isConfigured()) continue;
    const res = await syncSingleSource(s.slug);
    summary.push({ slug: s.slug, ...res });
  }

  return summary;
}
