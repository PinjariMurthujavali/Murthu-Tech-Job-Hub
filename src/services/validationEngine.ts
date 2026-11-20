import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { jobs, validationLogs } from '../db/schema.ts';

const CLOSED_PHRASES = [
  'this job is no longer available',
  'job has expired',
  'position has been filled',
  'no longer accepting applications',
  'applications are closed',
  'this listing has been removed',
  'job not found',
];

export async function validateSingleJob(jobId: number): Promise<{
  jobId: number;
  previousStatus: string;
  newStatus: string;
  outcome: string;
  httpStatus: number | null;
}> {
  const rows = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!rows.length) {
    throw new Error('Job not found for validation');
  }

  const job = rows[0];
  const previousStatus = job.verificationStatus;
  const now = new Date();

  // 1. Automatic expiration check
  if (job.expiresAt && job.expiresAt.getTime() < now.getTime()) {
    await db
      .update(jobs)
      .set({
        verificationStatus: 'EXPIRED',
        lastVerifiedAt: now,
        validationPriority: 0,
        updatedAt: now,
      })
      .where(eq(jobs.id, job.id));

    await db.insert(validationLogs).values({
      jobId: job.id,
      previousStatus,
      newStatus: 'EXPIRED',
      httpStatus: null,
      checkOutcome: 'EXPIRED',
      details: 'Listing passed configured expiration timestamp.',
    });

    return {
      jobId: job.id,
      previousStatus,
      newStatus: 'EXPIRED',
      outcome: 'EXPIRED',
      httpStatus: null,
    };
  }

  // 2. HTTP accessibility & closed-marker check against original applyUrl
  let httpStatus: number | null = null;
  let newStatus = previousStatus;
  let outcome = 'ACTIVE';
  let details = 'Application endpoint responded active.';

  try {
    let response = await fetch(job.applyUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MurthuJobHubVerifier/1.0)',
      },
      signal: AbortSignal.timeout(9000),
    });

    // Some ATS endpoints return 405 Method Not Allowed or 403 for HEAD; fallback to GET
    if (response.status === 405 || response.status === 403) {
      response = await fetch(job.applyUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MurthuJobHubVerifier/1.0)',
          Range: 'bytes=0-16384',
        },
        signal: AbortSignal.timeout(10000),
      });
    }

    httpStatus = response.status;

    if (httpStatus === 404 || httpStatus === 410) {
      newStatus = 'CLOSED';
      outcome = 'CLOSED';
      details = `Employer application page returned HTTP ${httpStatus}.`;
    } else if (httpStatus >= 200 && httpStatus < 400) {
      // Inspect partial HTML body on GET if possible for closed phrases
      let closedDetected = false;
      if (response.body) {
        try {
          const text = (await response.text()).slice(0, 18000).toLowerCase();
          for (const phrase of CLOSED_PHRASES) {
            if (text.includes(phrase)) {
              closedDetected = true;
              details = `Detected closed notice ("${phrase}") on application page.`;
              break;
            }
          }
        } catch {
          // ignore body read errors if stream closed
        }
      }

      if (closedDetected) {
        newStatus = 'CLOSED';
        outcome = 'CLOSED';
      } else {
        newStatus = 'LIVE VERIFIED';
        outcome = 'ACTIVE';
        details = `Verified HTTP ${httpStatus} active application page.`;
      }
    } else if (httpStatus === 429 || httpStatus >= 500) {
      // Temporary rate limit or upstream server error -> DO NOT mark CLOSED
      outcome = 'NETWORK_ERROR';
      details = `Transient HTTP ${httpStatus} response; status preserved pending retry.`;
    } else {
      // e.g., 401/403 bot shield on ATS -> keep UNVERIFIED / UNDER REVIEW instead of false CLOSED
      outcome = 'NETWORK_ERROR';
      details = `HTTP ${httpStatus} access restriction; cannot auto-confirm closure.`;
    }
  } catch (err) {
    // Temporary network failure MUST NOT classify a job as closed
    outcome = 'NETWORK_ERROR';
    details = `Transient network error (${
      err instanceof Error ? err.message : 'timeout'
    }); preserved status.`;
  }

  const failures = outcome === 'NETWORK_ERROR' ? job.validationFailures + 1 : 0;
  if (outcome === 'NETWORK_ERROR' && failures >= 4 && previousStatus === 'LIVE VERIFIED') {
    newStatus = 'UNVERIFIED';
  }

  await db
    .update(jobs)
    .set({
      verificationStatus: newStatus,
      validationFailures: failures,
      validationPriority: 0,
      lastVerifiedAt: outcome === 'NETWORK_ERROR' ? job.lastVerifiedAt : now,
      updatedAt: now,
    })
    .where(eq(jobs.id, job.id));

  await db.insert(validationLogs).values({
    jobId: job.id,
    previousStatus,
    newStatus,
    httpStatus,
    checkOutcome: outcome,
    details,
  });

  return {
    jobId: job.id,
    previousStatus,
    newStatus,
    outcome,
    httpStatus,
  };
}

export async function runValidationBatch(limitCount = 15) {
  const candidates = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.isDeleted, false),
        inArray(jobs.verificationStatus, ['UNVERIFIED', 'UNDER REVIEW', 'LIVE VERIFIED'])
      )
    )
    .orderBy(desc(jobs.validationPriority), sql`${jobs.lastVerifiedAt} ASC NULLS FIRST`)
    .limit(limitCount);

  const results = [];
  for (const c of candidates) {
    try {
      const res = await validateSingleJob(c.id);
      results.push(res);
    } catch (err) {
      console.error(`Validation failed for job ${c.id}:`, err);
    }
  }
  return results;
}

export async function runExpirySweep(): Promise<number> {
  const now = new Date();
  const expired = await db
    .update(jobs)
    .set({ verificationStatus: 'EXPIRED', updatedAt: now })
    .where(
      and(
        eq(jobs.isDeleted, false),
        lt(jobs.expiresAt, now),
        inArray(jobs.verificationStatus, ['LIVE VERIFIED', 'UNVERIFIED', 'UNDER REVIEW'])
      )
    )
    .returning({ id: jobs.id });

  return expired.length;
}
