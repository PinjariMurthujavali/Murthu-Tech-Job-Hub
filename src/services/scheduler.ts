import { count, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { jobs } from '../db/schema.ts';
import { seedBaselineData } from '../db/seed.ts';
import { syncAllEnabledSources } from './syncEngine.ts';
import { runExpirySweep, runValidationBatch } from './validationEngine.ts';

let isSyncRunning = false;
let isValidationRunning = false;
let started = false;

export const schedulerState = {
  startedAt: null as Date | null,
  lastSyncRunAt: null as Date | null,
  lastValidationRunAt: null as Date | null,
  lastExpiryRunAt: null as Date | null,
  isSyncRunning: false,
  isValidationRunning: false,
};

export function startBackgroundScheduler() {
  if (started) return;
  started = true;
  schedulerState.startedAt = new Date();

  // Warm bootstrap 3 seconds after server listens so HTTP server starts immediately
  setTimeout(async () => {
    try {
      await seedBaselineData();
      const [{ total }] = await db.select({ total: count() }).from(jobs);
      if (Number(total) === 0) {
        isSyncRunning = true;
        schedulerState.isSyncRunning = true;
        await syncAllEnabledSources();
        schedulerState.lastSyncRunAt = new Date();
        isSyncRunning = false;
        schedulerState.isSyncRunning = false;

        // Immediately validate initial batch so live jobs receive real HTTP verification
        isValidationRunning = true;
        schedulerState.isValidationRunning = true;
        await runValidationBatch(25);
        schedulerState.lastValidationRunAt = new Date();
        isValidationRunning = false;
        schedulerState.isValidationRunning = false;
      }
    } catch (err) {
      console.error('Initial scheduler bootstrap error:', err);
      isSyncRunning = false;
      isValidationRunning = false;
      schedulerState.isSyncRunning = false;
      schedulerState.isValidationRunning = false;
    }
  }, 3000);

  // Sync external sources every 30 minutes
  setInterval(async () => {
    if (isSyncRunning) return;
    isSyncRunning = true;
    schedulerState.isSyncRunning = true;
    try {
      await syncAllEnabledSources();
      schedulerState.lastSyncRunAt = new Date();
    } catch (err) {
      console.error('Scheduled source sync error:', err);
    } finally {
      isSyncRunning = false;
      schedulerState.isSyncRunning = false;
    }
  }, 30 * 60 * 1000);

  // Validate live job URLs every 10 minutes
  setInterval(async () => {
    if (isValidationRunning) return;
    isValidationRunning = true;
    schedulerState.isValidationRunning = true;
    try {
      await runValidationBatch(15);
      schedulerState.lastValidationRunAt = new Date();
    } catch (err) {
      console.error('Scheduled validation error:', err);
    } finally {
      isValidationRunning = false;
      schedulerState.isValidationRunning = false;
    }
  }, 10 * 60 * 1000);

  // Expiry sweep every 15 minutes
  setInterval(async () => {
    try {
      await runExpirySweep();
      schedulerState.lastExpiryRunAt = new Date();
    } catch (err) {
      console.error('Scheduled expiry sweep error:', err);
    }
  }, 15 * 60 * 1000);
}
