import { db } from './index.ts';
import { jobCategories, jobSources, jobSubcategories } from './schema.ts';
import { slugify } from '../services/sources/normalize.ts';

export const CATEGORY_SEED: Array<{
  groupName: string;
  items: string[];
}> = [
  {
    groupName: 'Software & IT',
    items: [
      'Software Developer',
      'Python Developer',
      'Java Developer',
      'JavaScript Developer',
      'React Developer',
      'Angular Developer',
      'Node.js Developer',
      'Full Stack Developer',
      'Frontend Developer',
      'Backend Developer',
      'PHP Developer',
      '.NET Developer',
      'Flutter Developer',
      'Android Developer',
      'iOS Developer',
      'AI Engineer',
      'Machine Learning Engineer',
      'Data Analyst',
      'Data Scientist',
      'Data Engineer',
      'Cloud Engineer',
      'DevOps Engineer',
      'Cybersecurity',
      'Network Engineer',
      'Software Tester',
      'QA Engineer',
      'ERPNext Developer',
      'Frappe Developer',
      'UI/UX Designer',
      'Technical Support',
    ],
  },
  {
    groupName: 'Hardware & Core',
    items: [
      'Hardware Engineer',
      'Embedded Systems Engineer',
      'VLSI Engineer',
      'PCB Design Engineer',
      'Electronics Engineer',
      'Electrical Engineer',
      'Mechanical Engineer',
      'Civil Engineer',
      'Automobile Engineer',
      'Robotics Engineer',
      'Mechatronics Engineer',
      'Production Engineer',
      'Quality Engineer',
      'Maintenance Engineer',
      'Instrumentation Engineer',
      'Telecom Engineer',
      'Manufacturing Engineer',
    ],
  },
  {
    groupName: 'Government & Public',
    items: [
      'Government Jobs',
      'Banking Jobs',
      'Railway Jobs',
      'Defence Jobs',
      'Teaching Jobs',
      'Healthcare Jobs',
      'Research Jobs',
      'Legal Jobs',
      'Agriculture',
    ],
  },
  {
    groupName: 'Business, Operations & Work Types',
    items: [
      'HR Jobs',
      'Accounting Jobs',
      'Finance Jobs',
      'Sales Jobs',
      'Marketing Jobs',
      'Digital Marketing',
      'Customer Support',
      'BPO / KPO',
      'Data Entry',
      'Logistics',
      'Hospitality',
      'Retail',
      'Manufacturing',
      'Construction',
      'Work From Home',
      'Remote Jobs',
      'Hybrid Jobs',
      'Freelance',
      'Part-Time',
      'Full-Time',
      'Internships',
      'Apprenticeships',
      'Walk-in Interviews',
    ],
  },
];

export async function seedBaselineData() {
  // 1. Seed all canonical categories
  let order = 1;
  for (const group of CATEGORY_SEED) {
    for (const name of group.items) {
      const slug = slugify(name);
      await db
        .insert(jobCategories)
        .values({
          name,
          slug,
          groupName: group.groupName,
          description: `Verified ${name} opportunities across India and remote teams.`,
          sortOrder: order++,
        })
        .onConflictDoNothing({ target: jobCategories.slug });
    }
  }

  // Seed sample subcategories for primary categories
  const existingCategories = await db.select().from(jobCategories);
  const byName = new Map(existingCategories.map((c) => [c.name, c.id]));

  const subSeeds: Array<[string, string[]]> = [
    ['Software Developer', ['Backend Systems', 'API Engineering', 'Microservices']],
    ['VLSI Engineer', ['RTL Design', 'Physical Design', 'Verification']],
    ['Embedded Systems Engineer', ['Firmware C/C++', 'Automotive ECU', 'IoT Devices']],
    ['Government Jobs', ['Central Govt PSU', 'State PSC', 'Technical Officer']],
  ];

  for (const [catName, subs] of subSeeds) {
    const categoryId = byName.get(catName);
    if (!categoryId) continue;
    for (const sub of subs) {
      await db
        .insert(jobSubcategories)
        .values({
          categoryId,
          name: sub,
          slug: slugify(`${catName}-${sub}`),
        })
        .onConflictDoNothing({ target: jobSubcategories.slug });
    }
  }

  // 2. Seed legitimate job sources with honest status
  const serpConfigured = Boolean(process.env.SERPAPI_API_KEY?.trim());
  const adzunaConfigured = Boolean(
    process.env.ADZUNA_APP_ID?.trim() && process.env.ADZUNA_APP_KEY?.trim()
  );

  const sources = [
    {
      name: 'SerpApi Google Jobs',
      slug: 'serpapi-google-jobs',
      sourceType: 'api',
      endpointUrl: 'https://serpapi.com/search.json?engine=google_jobs',
      isEnabled: true,
      status: serpConfigured ? 'ACTIVE' : 'AWAITING_API_KEY',
      statusMessage: serpConfigured
        ? 'Live Google Jobs API integration configured (LinkedIn, Naukri, Indeed, Glassdoor, Foundit & company career pages).'
        : 'Add SERPAPI_API_KEY environment variable to enable live Google Jobs API aggregation.',
    },
    {
      name: 'Remotive',
      slug: 'remotive',
      sourceType: 'api',
      endpointUrl: 'https://remotive.com/api/remote-jobs',
      isEnabled: true,
      status: 'ACTIVE',
      statusMessage: 'Official Remotive public remote jobs API active.',
    },
    {
      name: 'Arbeitnow',
      slug: 'arbeitnow',
      sourceType: 'api',
      endpointUrl: 'https://www.arbeitnow.com/api/job-board-api',
      isEnabled: true,
      status: 'ACTIVE',
      statusMessage: 'Official Arbeitnow public job board API active.',
    },
    {
      name: 'Jobicy',
      slug: 'jobicy',
      sourceType: 'api',
      endpointUrl: 'https://jobicy.com/api/v2/remote-jobs',
      isEnabled: true,
      status: 'ACTIVE',
      statusMessage: 'Official Jobicy remote jobs public feed active.',
    },
    {
      name: 'The Muse',
      slug: 'the-muse',
      sourceType: 'api',
      endpointUrl: 'https://www.themuse.com/api/public/jobs',
      isEnabled: true,
      status: 'ACTIVE',
      statusMessage: 'Official The Muse public jobs API active.',
    },
    {
      name: 'Adzuna India',
      slug: 'adzuna-india',
      sourceType: 'api',
      endpointUrl: 'https://api.adzuna.com/v1/api/jobs/in/search/1',
      isEnabled: true,
      status: adzunaConfigured ? 'ACTIVE' : 'AWAITING_API_KEY',
      statusMessage: adzunaConfigured
        ? 'Official Adzuna India API active.'
        : 'Add ADZUNA_APP_ID and ADZUNA_APP_KEY to enable Adzuna India feed.',
    },
    {
      name: 'National Career Service (NCS)',
      slug: 'national-career-service',
      sourceType: 'partner_unavailable',
      endpointUrl: 'https://www.ncs.gov.in',
      isEnabled: false,
      status: 'UNAVAILABLE',
      statusMessage:
        'Requires authorized Ministry of Labour partner API credentials; no public unauthenticated endpoint available.',
    },
    {
      name: 'Direct Employer & Admin Verified',
      slug: 'direct-employer',
      sourceType: 'manual',
      endpointUrl: 'internal://admin-verified',
      isEnabled: true,
      status: 'ACTIVE',
      statusMessage: 'Direct verified employer & government recruitment listings added by portal admins.',
    },
  ];

  for (const src of sources) {
    await db
      .insert(jobSources)
      .values(src)
      .onConflictDoUpdate({
        target: jobSources.slug,
        set: {
          status: src.status,
          statusMessage: src.statusMessage,
          endpointUrl: src.endpointUrl,
          updatedAt: new Date(),
        },
      });
  }
}
