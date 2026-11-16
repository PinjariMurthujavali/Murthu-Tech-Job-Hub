import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { jobAlerts, notifications } from '../db/schema.ts';

export interface AlertMatchCandidate {
  id: number;
  title: string;
  companyName: string;
  categoryName: string;
  location: string;
  city: string | null;
  experienceLevel: string;
  workMode: string;
  sector: string;
}

export async function matchJobsToAlerts(newJobs: AlertMatchCandidate[]): Promise<number> {
  if (!newJobs.length) return 0;

  try {
    const activeAlerts = await db
      .select()
      .from(jobAlerts)
      .where(eq(jobAlerts.isActive, true));

    if (!activeAlerts.length) return 0;

    let createdCount = 0;

    for (const alert of activeAlerts) {
      const kw = (alert.keywords || '').trim().toLowerCase();
      const loc = (alert.location || '').trim().toLowerCase();
      const cat = (alert.category || '').trim().toLowerCase();

      for (const job of newJobs) {
        if (kw) {
          const hay = `${job.title} ${job.companyName} ${job.categoryName}`.toLowerCase();
          if (!hay.includes(kw)) continue;
        }
        if (loc) {
          const locHay = `${job.location} ${job.city || ''} ${job.workMode}`.toLowerCase();
          if (!locHay.includes(loc)) continue;
        }
        if (cat && !job.categoryName.toLowerCase().includes(cat)) continue;
        if (alert.experienceLevel && job.experienceLevel !== alert.experienceLevel) continue;
        if (alert.workMode && job.workMode !== alert.workMode) continue;
        if (alert.sector && job.sector !== alert.sector) continue;

        const dedupeKey = `alert:${alert.id}:job:${job.id}`;
        if (alert.inAppEnabled) {
          const inserted = await db
            .insert(notifications)
            .values({
              userId: alert.userId,
              alertId: alert.id,
              jobId: job.id,
              title: `New Match: ${job.title}`,
              message: `${job.companyName} · ${job.location} (${job.categoryName}) matched your alert "${alert.title}".`,
              dedupeKey,
            })
            .onConflictDoNothing({ target: notifications.dedupeKey })
            .returning();

          if (inserted.length > 0) {
            createdCount++;
            await db
              .update(jobAlerts)
              .set({ lastTriggeredAt: new Date() })
              .where(eq(jobAlerts.id, alert.id));
          }
        }
      }
    }

    return createdCount;
  } catch (err) {
    console.error('Job alert matching error:', err);
    return 0;
  }
}
