import {
  extractSkillsFromText,
  inferCategoryName,
  inferEmploymentAndExperience,
  parseLocationDetails,
  stripHtmlToCleanText,
} from './normalize.ts';
import type { JobSourceAdapter, NormalizedJobInput, SourceFetchResult } from './types.ts';

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo?: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

export const remotiveAdapter: JobSourceAdapter = {
  slug: 'remotive',
  name: 'Remotive',
  isConfigured() {
    return true;
  },
  async fetchJobs(): Promise<SourceFetchResult> {
    try {
      const response = await fetch('https://remotive.com/api/remote-jobs?limit=60', {
        headers: { 'User-Agent': 'MurthuJobHub/1.0 (+https://murthujobhub.app)' },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        return { jobs: [], error: `Remotive API returned HTTP ${response.status}` };
      }
      const data = (await response.json()) as { jobs?: RemotiveJob[] };
      const rawJobs = Array.isArray(data.jobs) ? data.jobs : [];

      const normalized: NormalizedJobInput[] = [];
      for (const item of rawJobs) {
        if (!item.id || !item.title || !item.company_name || !item.url) continue;
        const cleanDesc = stripHtmlToCleanText(item.description || '');
        const locDetails = parseLocationDetails(
          item.candidate_required_location || 'Remote',
          item.title,
          cleanDesc
        );
        const emp = inferEmploymentAndExperience(item.title, cleanDesc, item.job_type || '');
        const category = inferCategoryName(item.title, item.category || '', cleanDesc);
        const skills = extractSkillsFromText(item.title, cleanDesc, item.tags || []);

        normalized.push({
          sourceName: 'Remotive',
          externalJobId: String(item.id),
          title: item.title.trim(),
          companyName: item.company_name.trim(),
          companyLogoUrl: item.company_logo || undefined,
          rawCategory: item.category,
          description: cleanDesc || `${item.title} at ${item.company_name}`,
          location: locDetails.location,
          city: locDetails.city || 'Remote',
          state: locDetails.state || undefined,
          country: locDetails.country,
          workMode: 'Remote',
          employmentType: emp.employmentType,
          sector: emp.sector,
          experienceLevel: emp.experienceLevel,
          experienceMin: emp.experienceMin,
          experienceMax: emp.experienceMax,
          salaryDisplay: item.salary?.trim() || null,
          applyUrl: item.url,
          skills,
          postedAt: item.publication_date ? new Date(item.publication_date) : new Date(),
        });
      }

      return { jobs: normalized };
    } catch (err) {
      return {
        jobs: [],
        error: err instanceof Error ? err.message : 'Failed to fetch from Remotive',
      };
    }
  },
};
