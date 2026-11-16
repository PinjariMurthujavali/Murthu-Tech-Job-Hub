export interface NormalizedJobInput {
  sourceName: string;
  externalJobId: string;
  title: string;
  companyName: string;
  companyWebsite?: string;
  companyLogoUrl?: string;
  rawCategory?: string;
  description: string;
  qualifications?: string;
  location: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  workMode: 'Office' | 'Remote' | 'Hybrid';
  employmentType: 'Full-time' | 'Part-time' | 'Internship' | 'Contract' | 'Freelance' | 'Apprenticeship' | 'Walk-in';
  sector: 'Private' | 'Government';
  experienceLevel: 'Fresher' | '0-1 Years' | '1-3 Years' | '3-5 Years' | '5-10 Years' | '10+ Years';
  experienceMin: number;
  experienceMax: number;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string;
  salaryDisplay?: string | null;
  applyUrl: string;
  skills: string[];
  postedAt: Date;
  expiresAt?: Date | null;
}

export interface SourceFetchResult {
  jobs: NormalizedJobInput[];
  error?: string;
}

export interface JobSourceAdapter {
  slug: string;
  name: string;
  isConfigured(): boolean;
  fetchJobs(): Promise<SourceFetchResult>;
}
