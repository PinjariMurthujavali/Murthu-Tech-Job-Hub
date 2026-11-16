import {
  extractSkillsFromText,
  inferCategoryName,
  inferEmploymentAndExperience,
  parseLocationDetails,
  stripHtmlToCleanText,
} from './normalize.ts';
import type { JobSourceAdapter, NormalizedJobInput, SourceFetchResult } from './types.ts';

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
}

export const arbeitnowAdapter: JobSourceAdapter = {
  slug: 'arbeitnow',
  name: 'Arbeitnow',
  isConfigured() {
    return true;
  },
  async fetchJobs(): Promise<SourceFetchResult> {
    try {
      const response = await fetch('https://www.arbeitnow.com/api/job-board-api', {
        headers: { 'User-Agent': 'MurthuJobHub/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        return { jobs: [], error: `Arbeitnow API returned HTTP ${response.status}` };
      }
      const data = (await response.json()) as { data?: ArbeitnowJob[] };
      const rawJobs = Array.isArray(data.data) ? data.data.slice(0, 60) : [];

      const normalized: NormalizedJobInput[] = [];
      for (const item of rawJobs) {
        if (!item.slug || !item.title || !item.company_name || !item.url) continue;
        const cleanDesc = stripHtmlToCleanText(item.description || '');
        const rawLoc = item.location || (item.remote ? 'Remote' : 'International');
        const locDetails = parseLocationDetails(rawLoc, item.title, cleanDesc);
        const emp = inferEmploymentAndExperience(
          item.title,
          cleanDesc,
          (item.job_types || []).join(' ')
        );
        const category = inferCategoryName(item.title, (item.tags || []).join(' '), cleanDesc);
        const skills = extractSkillsFromText(item.title, cleanDesc, item.tags || []);

        normalized.push({
          sourceName: 'Arbeitnow',
          externalJobId: item.slug,
          title: item.title.trim(),
          companyName: item.company_name.trim(),
          rawCategory: category,
          description: cleanDesc || `${item.title} at ${item.company_name}`,
          location: item.remote && !rawLoc.toLowerCase().includes('remote') ? `${rawLoc} (Remote)` : rawLoc,
          city: locDetails.city || undefined,
          state: locDetails.state || undefined,
          country: locDetails.country,
          workMode: item.remote ? 'Remote' : locDetails.workMode,
          employmentType: emp.employmentType,
          sector: emp.sector,
          experienceLevel: emp.experienceLevel,
          experienceMin: emp.experienceMin,
          experienceMax: emp.experienceMax,
          applyUrl: item.url,
          skills,
          postedAt: item.created_at ? new Date(item.created_at * 1000) : new Date(),
        });
      }

      return { jobs: normalized };
    } catch (err) {
      return {
        jobs: [],
        error: err instanceof Error ? err.message : 'Failed to fetch from Arbeitnow',
      };
    }
  },
};
