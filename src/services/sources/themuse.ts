import {
  extractSkillsFromText,
  inferCategoryName,
  inferEmploymentAndExperience,
  parseLocationDetails,
  stripHtmlToCleanText,
} from './normalize.ts';
import type { JobSourceAdapter, NormalizedJobInput, SourceFetchResult } from './types.ts';

interface MuseJob {
  id: number;
  name: string;
  contents?: string;
  publication_date?: string;
  locations?: Array<{ name: string }>;
  categories?: Array<{ name: string }>;
  levels?: Array<{ name: string; short_name: string }>;
  company?: { name: string };
  refs?: { landing_page: string };
}

export const themuseAdapter: JobSourceAdapter = {
  slug: 'the-muse',
  name: 'The Muse',
  isConfigured() {
    return true;
  },
  async fetchJobs(): Promise<SourceFetchResult> {
    try {
      const urls = [
        'https://www.themuse.com/api/public/jobs?page=1',
        'https://www.themuse.com/api/public/jobs?location=Hyderabad%2C%20India&page=1',
        'https://www.themuse.com/api/public/jobs?location=Bengaluru%2C%20India&page=1',
      ];

      const allRaw: MuseJob[] = [];
      for (const url of urls) {
        try {
          const resp = await fetch(url, {
            headers: { 'User-Agent': 'MurthuJobHub/1.0' },
            signal: AbortSignal.timeout(12000),
          });
          if (resp.ok) {
            const data = (await resp.json()) as { results?: MuseJob[] };
            if (Array.isArray(data.results)) {
              allRaw.push(...data.results.slice(0, 25));
            }
          }
        } catch {
          // continue other queries
        }
      }

      if (!allRaw.length) {
        return { jobs: [], error: 'The Muse API returned no results' };
      }

      const seen = new Set<number>();
      const normalized: NormalizedJobInput[] = [];
      for (const item of allRaw) {
        if (!item.id || seen.has(item.id) || !item.name || !item.company?.name || !item.refs?.landing_page) {
          continue;
        }
        seen.add(item.id);
        const cleanDesc = stripHtmlToCleanText(item.contents || '');
        const rawLoc = (item.locations || []).map((l) => l.name).join(', ') || 'Flexible';
        const locDetails = parseLocationDetails(rawLoc, item.name, cleanDesc);
        const levelHint = (item.levels || []).map((l) => l.name).join(' ');
        const catHint = (item.categories || []).map((c) => c.name).join(' ');
        const emp = inferEmploymentAndExperience(`${item.name} ${levelHint}`, cleanDesc, '');
        const skills = extractSkillsFromText(item.name, cleanDesc, []);

        normalized.push({
          sourceName: 'The Muse',
          externalJobId: String(item.id),
          title: item.name.trim(),
          companyName: item.company.name.trim(),
          rawCategory: inferCategoryName(item.name, catHint, cleanDesc),
          description: cleanDesc || `${item.name} at ${item.company.name}`,
          location: rawLoc,
          city: locDetails.city || undefined,
          state: locDetails.state || undefined,
          country: locDetails.country,
          workMode: locDetails.workMode,
          employmentType: emp.employmentType,
          sector: emp.sector,
          experienceLevel: emp.experienceLevel,
          experienceMin: emp.experienceMin,
          experienceMax: emp.experienceMax,
          applyUrl: item.refs.landing_page,
          skills,
          postedAt: item.publication_date ? new Date(item.publication_date) : new Date(),
        });
      }

      return { jobs: normalized };
    } catch (err) {
      return {
        jobs: [],
        error: err instanceof Error ? err.message : 'Failed to fetch from The Muse',
      };
    }
  },
};
