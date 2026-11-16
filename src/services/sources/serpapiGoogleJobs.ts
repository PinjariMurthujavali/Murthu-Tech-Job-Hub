import {
  extractSkillsFromText,
  inferCategoryName,
  inferEmploymentAndExperience,
  parseLocationDetails,
} from './normalize.ts';
import type { JobSourceAdapter, NormalizedJobInput, SourceFetchResult } from './types.ts';

interface SerpApiJobResult {
  job_id?: string;
  title?: string;
  company_name?: string;
  location?: string;
  via?: string;
  description?: string;
  thumbnail?: string;
  extensions?: string[];
  detected_extensions?: {
    posted_at?: string;
    schedule_type?: string;
    salary?: string;
    work_from_home?: boolean;
  };
  apply_options?: Array<{
    title?: string;
    link?: string;
  }>;
  share_link?: string;
}

const DEFAULT_SERPAPI_QUERIES = [
  { q: 'Software Developer jobs in Hyderabad', location: 'Hyderabad, Telangana, India' },
  { q: 'Hardware Embedded VLSI Engineer jobs in India', location: 'Bengaluru, Karnataka, India' },
  { q: 'Fresher Internship Software Engineer India', location: 'India' },
  { q: 'Government PSU Engineering jobs India', location: 'India' },
];

export async function fetchSerpApiQuery(
  query: string,
  location = 'India'
): Promise<SourceFetchResult> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) {
    return {
      jobs: [],
      error: 'SERPAPI_API_KEY is not configured in environment variables.',
    };
  }

  try {
    const params = new URLSearchParams({
      engine: 'google_jobs',
      q: query,
      location,
      hl: 'en',
      gl: 'in',
      api_key: apiKey,
    });

    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      signal: AbortSignal.timeout(18000),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        jobs: [],
        error: `SerpApi returned HTTP ${response.status}: ${text.slice(0, 200)}`,
      };
    }

    const data = (await response.json()) as {
      error?: string;
      jobs_results?: SerpApiJobResult[];
    };

    if (data.error) {
      return { jobs: [], error: data.error };
    }

    const results = Array.isArray(data.jobs_results) ? data.jobs_results : [];
    const normalized: NormalizedJobInput[] = [];

    for (const item of results) {
      const applyLink = item.apply_options?.[0]?.link || item.share_link;
      if (!item.job_id || !item.title || !item.company_name || !applyLink) continue;

      const rawLoc = item.location || location;
      const desc = item.description || `${item.title} at ${item.company_name}`;
      const locDetails = parseLocationDetails(rawLoc, item.title, desc);
      const scheduleHint =
        item.detected_extensions?.schedule_type || (item.extensions || []).join(' ');
      const emp = inferEmploymentAndExperience(item.title, desc, scheduleHint);
      const skills = extractSkillsFromText(item.title, desc, []);

      normalized.push({
        sourceName: 'SerpApi Google Jobs',
        externalJobId: item.job_id,
        title: item.title.trim(),
        companyName: item.company_name.trim(),
        companyLogoUrl: item.thumbnail || undefined,
        rawCategory: inferCategoryName(item.title, '', desc),
        description: desc,
        location: rawLoc,
        city: locDetails.city || undefined,
        state: locDetails.state || undefined,
        country: locDetails.country,
        workMode: item.detected_extensions?.work_from_home ? 'Remote' : locDetails.workMode,
        employmentType: emp.employmentType,
        sector: emp.sector,
        experienceLevel: emp.experienceLevel,
        experienceMin: emp.experienceMin,
        experienceMax: emp.experienceMax,
        salaryDisplay: item.detected_extensions?.salary || null,
        applyUrl: applyLink,
        skills,
        postedAt: new Date(),
      });
    }

    return { jobs: normalized };
  } catch (err) {
    return {
      jobs: [],
      error: err instanceof Error ? err.message : 'SerpApi Google Jobs request failed',
    };
  }
}

export const serpApiGoogleJobsAdapter: JobSourceAdapter = {
  slug: 'serpapi-google-jobs',
  name: 'SerpApi Google Jobs',
  isConfigured() {
    return Boolean(process.env.SERPAPI_API_KEY?.trim());
  },
  async fetchJobs(): Promise<SourceFetchResult> {
    if (!this.isConfigured()) {
      return {
        jobs: [],
        error: 'SERPAPI_API_KEY is not configured. Set SERPAPI_API_KEY to activate Google Jobs sync.',
      };
    }

    const allJobs: NormalizedJobInput[] = [];
    const errors: string[] = [];

    for (const q of DEFAULT_SERPAPI_QUERIES) {
      const result = await fetchSerpApiQuery(q.q, q.location);
      if (result.jobs.length) {
        allJobs.push(...result.jobs);
      }
      if (result.error) {
        errors.push(result.error);
      }
    }

    return {
      jobs: allJobs,
      error: allJobs.length === 0 && errors.length ? errors[0] : undefined,
    };
  },
};
