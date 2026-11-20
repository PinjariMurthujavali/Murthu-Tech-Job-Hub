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

// India-focused query pool. Each run uses only a few (rotating daily) so the
// SerpApi free plan (~250 searches/month) is not exhausted.
const INDIA_CITIES: Array<{ name: string; location: string }> = [
  { name: 'Hyderabad', location: 'Hyderabad, Telangana, India' },
  { name: 'Bengaluru', location: 'Bengaluru, Karnataka, India' },
  { name: 'Chennai', location: 'Chennai, Tamil Nadu, India' },
  { name: 'Pune', location: 'Pune, Maharashtra, India' },
  { name: 'Mumbai', location: 'Mumbai, Maharashtra, India' },
  { name: 'Delhi NCR', location: 'Delhi, India' },
  { name: 'Noida', location: 'Noida, Uttar Pradesh, India' },
  { name: 'Vijayawada', location: 'Vijayawada, Andhra Pradesh, India' },
  { name: 'Visakhapatnam', location: 'Visakhapatnam, Andhra Pradesh, India' },
  { name: 'Warangal', location: 'Warangal, Telangana, India' },
];

const ROLES = [
  'Software Developer',
  'Python Developer',
  'Frappe ERPNext Developer',
  'Embedded VLSI Hardware Engineer',
  'Fresher Software Engineer',
];

const DEFAULT_SERPAPI_QUERIES: Array<{ q: string; location: string }> = [
  // Hyderabad gets the most coverage
  ...ROLES.map((r) => ({ q: `${r} jobs in Hyderabad`, location: 'Hyderabad, Telangana, India' })),
  ...INDIA_CITIES.slice(1).flatMap((c) => [
    { q: `Software Developer jobs in ${c.name}`, location: c.location },
    { q: `Fresher Engineer jobs in ${c.name}`, location: c.location },
  ]),
  { q: 'Government PSU Engineering jobs India', location: 'India' },
  { q: 'Internship Software Engineer India', location: 'India' },
  { q: 'Work from home developer jobs India', location: 'India' },
];

function pickTodaysQueries(): Array<{ q: string; location: string }> {
  const perRun = Math.max(1, parseInt(process.env.SERPAPI_QUERIES_PER_RUN || '8', 10) || 8);
  const total = DEFAULT_SERPAPI_QUERIES.length;
  const day = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const startIdx = (day * perRun) % total;
  return Array.from({ length: Math.min(perRun, total) }, (_, i) => DEFAULT_SERPAPI_QUERIES[(startIdx + i) % total]);
}

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

    for (const q of pickTodaysQueries()) {
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
