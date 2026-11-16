import {
  extractSkillsFromText,
  inferCategoryName,
  inferEmploymentAndExperience,
  parseLocationDetails,
  stripHtmlToCleanText,
} from './normalize.ts';
import type { JobSourceAdapter, NormalizedJobInput, SourceFetchResult } from './types.ts';

interface JobicyJob {
  id: number;
  url: string;
  jobTitle: string;
  companyName: string;
  companyLogo?: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  annualSalaryMin?: string;
  annualSalaryMax?: string;
  salaryCurrency?: string;
}

export const jobicyAdapter: JobSourceAdapter = {
  slug: 'jobicy',
  name: 'Jobicy',
  isConfigured() {
    return true;
  },
  async fetchJobs(): Promise<SourceFetchResult> {
    try {
      const response = await fetch('https://jobicy.com/api/v2/remote-jobs?count=50', {
        headers: { 'User-Agent': 'MurthuJobHub/1.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        return { jobs: [], error: `Jobicy API returned HTTP ${response.status}` };
      }
      const data = (await response.json()) as { jobs?: JobicyJob[] };
      const rawJobs = Array.isArray(data.jobs) ? data.jobs : [];

      const normalized: NormalizedJobInput[] = [];
      for (const item of rawJobs) {
        if (!item.id || !item.jobTitle || !item.companyName || !item.url) continue;
        const cleanDesc = stripHtmlToCleanText(item.jobDescription || item.jobExcerpt || '');
        const locDetails = parseLocationDetails(item.jobGeo || 'Remote', item.jobTitle, cleanDesc);
        const emp = inferEmploymentAndExperience(
          `${item.jobTitle} ${item.jobLevel || ''}`,
          cleanDesc,
          (item.jobType || []).join(' ')
        );
        const skills = extractSkillsFromText(item.jobTitle, cleanDesc, item.jobIndustry || []);

        const salaryMin = item.annualSalaryMin ? parseInt(item.annualSalaryMin, 10) || null : null;
        const salaryMax = item.annualSalaryMax ? parseInt(item.annualSalaryMax, 10) || null : null;
        const currency = item.salaryCurrency || 'USD';
        const salaryDisplay =
          salaryMin && salaryMax
            ? `${currency} ${salaryMin.toLocaleString()} - ${salaryMax.toLocaleString()} / yr`
            : null;

        normalized.push({
          sourceName: 'Jobicy',
          externalJobId: String(item.id),
          title: item.jobTitle.trim(),
          companyName: item.companyName.trim(),
          companyLogoUrl: item.companyLogo || undefined,
          rawCategory: (item.jobIndustry || []).join(', '),
          description: cleanDesc || `${item.jobTitle} at ${item.companyName}`,
          location: item.jobGeo ? `${item.jobGeo} (Remote)` : 'Remote',
          city: locDetails.city || 'Remote',
          state: locDetails.state || undefined,
          country: locDetails.country,
          workMode: 'Remote',
          employmentType: emp.employmentType,
          sector: emp.sector,
          experienceLevel: emp.experienceLevel,
          experienceMin: emp.experienceMin,
          experienceMax: emp.experienceMax,
          salaryMin,
          salaryMax,
          salaryCurrency: currency,
          salaryDisplay,
          applyUrl: item.url,
          skills,
          postedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        });
      }

      return { jobs: normalized };
    } catch (err) {
      return {
        jobs: [],
        error: err instanceof Error ? err.message : 'Failed to fetch from Jobicy',
      };
    }
  },
};
