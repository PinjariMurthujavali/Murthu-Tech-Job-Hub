export type VerificationStatus =
  | 'LIVE VERIFIED'
  | 'UNVERIFIED'
  | 'UNDER REVIEW'
  | 'CLOSED'
  | 'EXPIRED'
  | 'REMOVED';

export interface JobItem {
  id: number;
  slug: string;
  sourceId: number;
  sourceName: string;
  externalJobId: string;
  title: string;
  companyId: number | null;
  companyName: string;
  categoryId: number | null;
  categoryName: string;
  subcategoryName: string | null;
  description: string;
  qualifications: string | null;
  location: string;
  city: string | null;
  state: string | null;
  country: string;
  pincode: string | null;
  workMode: 'Office' | 'Remote' | 'Hybrid';
  employmentType: string;
  sector: 'Private' | 'Government';
  experienceLevel: string;
  experienceMin: number;
  experienceMax: number;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryDisplay: string | null;
  applyUrl: string;
  verificationStatus: VerificationStatus;
  lastVerifiedAt: string | null;
  postedAt: string;
  expiresAt: string | null;
  isFeatured: boolean;
  clickCount: number;
  reportCount: number;
  skills: string[];
}

export interface CategoryItem {
  id: number;
  name: string;
  slug: string;
  groupName: string;
  description: string | null;
  sortOrder: number;
  activeCount: number;
}

export interface CompanyItem {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  headquarters: string | null;
  activeJobs: number;
}

export interface PortalStats {
  liveVerifiedJobs: number;
  activeJobs: number;
  hiringCompanies: number;
  jobCategories: number;
  activeSources: number;
  hyderabadJobs: number;
  fresherJobs: number;
  governmentJobs: number;
  remoteJobs: number;
  internshipJobs: number;
  partTimeJobs: number;
}

export interface UserProfileData {
  id: number;
  userId: number;
  phone: string | null;
  headline: string | null;
  qualification: string | null;
  experienceYears: string | null;
  skills: string[];
  preferredLocation: string | null;
  preferredCategories: string[];
  resumeFilename: string | null;
  resumeUrl: string | null;
  bio: string | null;
}

export interface AuthUser {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  isSuspended?: boolean;
}
