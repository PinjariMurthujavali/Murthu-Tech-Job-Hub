import {
  extractSkillsFromText,
  inferCategoryName,
  inferEmploymentAndExperience,
  parseLocationDetails,
  stripHtmlToCleanText,
} from './normalize.ts';
import type { JobSourceAdapter, NormalizedJobInput, SourceFetchResult } from './types.ts';

interface AdzunaJob {
  id: string | number;
  title: string;
  description: string;
  redirect_url: string;
  created?: string;
  salary_min?: number;
  salary_max?: number;
  contract_type?: string;
  contract_time?: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  category?: { label?: string };
}

export const adzunaIndiaAdapter: JobSourceAdapter = {
  slug: 'adzuna-india',
  name: 'Adzuna India',
  isConfigured() {
    return Boolean(process.env.ADZUNA_APP_ID?.trim() && process.env.ADZUNA_APP_KEY?.trim());
  },
  async fetchJobs(): Promise<SourceFetchResult> {
    const appId = process.env.ADZUNA_APP_ID?.trim();
    const appKey = process.env.ADZUNA_APP_KEY?.trim();
    if (!appId || !appKey) {
      return {
        jobs: [],
        error: 'ADZUNA_APP_ID and ADZUNA_APP_KEY are not configured.',
      };
    }

    try {
      const url = `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${encodeURIComponent(
        appId
      )}&app_key=${encodeURIComponent(appKey)}&results_per_page=40`;

      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) {
        return { jobs: [], error: `Adzuna India returned HTTP ${response.status}` };
      }

      const data = (await response.json()) as { results?: AdzunaJob[] };
      const results = Array.isArray(data.results) ? data.results : [];
      const normalized: NormalizedJobInput[] = [];

      for (const item of results) {
        if (!item.id || !item.title || !item.redirect_url) continue;
        const companyName = item.company?.display_name?.trim() || 'Confidential Employer';
        const rawLoc = item.location?.display_name || 'India';
        const cleanDesc = stripHtmlToCleanText(item.description || '');
        const locDetails = parseLocationDetails(rawLoc, item.title, cleanDesc);
        const emp = inferEmploymentAndExperience(
          item.title,
          cleanDesc,
          `${item.contract_type || ''} ${item.contract_time || ''}`
        );
        const skills = extractSkillsFromText(item.title, cleanDesc, []);

        const salaryDisplay =
          item.salary_min && item.salary_max
            ? `INR ${Math.round(item.salary_min).toLocaleString('en-IN')} - ${Math.round(
                item.salary_max
              ).toLocaleString('en-IN')} / yr`
            : null;

        normalized.push({
          sourceName: 'Adzuna India',
          externalJobId: String(item.id),
          title: item.title.trim(),
          companyName,
          rawCategory: inferCategoryName(item.title, item.category?.label || '', cleanDesc),
          description: cleanDesc || item.title,
          location: rawLoc,
          city: locDetails.city || undefined,
          state: locDetails.state || undefined,
          country: 'India',
          workMode: locDetails.workMode,
          employmentType: emp.employmentType,
          sector: emp.sector,
          experienceLevel: emp.experienceLevel,
          experienceMin: emp.experienceMin,
          experienceMax: emp.experienceMax,
          salaryMin: item.salary_min ? Math.round(item.salary_min) : null,
          salaryMax: item.salary_max ? Math.round(item.salary_max) : null,
          salaryCurrency: 'INR',
          salaryDisplay,
          applyUrl: item.redirect_url,
          skills,
          postedAt: item.created ? new Date(item.created) : new Date(),
        });
      }

      return { jobs: normalized };
    } catch (err) {
      return {
        jobs: [],
        error: err instanceof Error ? err.message : 'Adzuna India fetch failed',
      };
    }
  },
};
