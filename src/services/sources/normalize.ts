import crypto from 'node:crypto';
import type { NormalizedJobInput } from './types.ts';

const INDIAN_CITY_STATE_MAP: Record<string, { city: string; state: string }> = {
  hyderabad: { city: 'Hyderabad', state: 'Telangana' },
  secunderabad: { city: 'Hyderabad', state: 'Telangana' },
  bengaluru: { city: 'Bengaluru', state: 'Karnataka' },
  bangalore: { city: 'Bengaluru', state: 'Karnataka' },
  chennai: { city: 'Chennai', state: 'Tamil Nadu' },
  mumbai: { city: 'Mumbai', state: 'Maharashtra' },
  navi: { city: 'Mumbai', state: 'Maharashtra' },
  pune: { city: 'Pune', state: 'Maharashtra' },
  delhi: { city: 'Delhi', state: 'Delhi NCR' },
  'new delhi': { city: 'Delhi', state: 'Delhi NCR' },
  noida: { city: 'Noida', state: 'Uttar Pradesh' },
  gurgaon: { city: 'Gurgaon', state: 'Haryana' },
  gurugram: { city: 'Gurgaon', state: 'Haryana' },
  kolkata: { city: 'Kolkata', state: 'West Bengal' },
  vijayawada: { city: 'Vijayawada', state: 'Andhra Pradesh' },
  visakhapatnam: { city: 'Visakhapatnam', state: 'Andhra Pradesh' },
  vizag: { city: 'Visakhapatnam', state: 'Andhra Pradesh' },
  tirupati: { city: 'Tirupati', state: 'Andhra Pradesh' },
  warangal: { city: 'Warangal', state: 'Telangana' },
  ahmedabad: { city: 'Ahmedabad', state: 'Gujarat' },
  kochi: { city: 'Kochi', state: 'Kerala' },
  jaipur: { city: 'Jaipur', state: 'Rajasthan' },
  chandigarh: { city: 'Chandigarh', state: 'Chandigarh' },
  indore: { city: 'Indore', state: 'Madhya Pradesh' },
  coimbatore: { city: 'Coimbatore', state: 'Tamil Nadu' },
};

export function stripHtmlToCleanText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, 8000);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function computeJobFingerprint(title: string, companyName: string, location: string): string {
  const norm = `${title.toLowerCase().replace(/[^a-z0-9]/g, '')}|${companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')}|${location.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24)}`;
  return crypto.createHash('sha256').update(norm).digest('hex').slice(0, 40);
}

export function parseLocationDetails(rawLocation: string, title = '', description = ''): {
  location: string;
  city: string | null;
  state: string | null;
  country: string;
  workMode: 'Office' | 'Remote' | 'Hybrid';
} {
  const loc = (rawLocation || 'Remote').trim();
  const combined = `${loc} ${title} ${description.slice(0, 400)}`.toLowerCase();

  let workMode: 'Office' | 'Remote' | 'Hybrid' = 'Office';
  if (/\bhybrid\b/i.test(combined)) {
    workMode = 'Hybrid';
  } else if (/\bremote\b|\bwork from home\b|\bwfh\b|\banywhere\b/i.test(loc.toLowerCase())) {
    workMode = 'Remote';
  }

  let city: string | null = null;
  let state: string | null = null;
  let country = 'International';

  const locLower = loc.toLowerCase();
  for (const [key, mapped] of Object.entries(INDIAN_CITY_STATE_MAP)) {
    if (locLower.includes(key)) {
      city = mapped.city;
      state = mapped.state;
      country = 'India';
      break;
    }
  }

  if (country !== 'India' && (/\bindia\b|\btelangana\b|\bkarnataka\b|\bmaharashtra\b|\btamil nadu\b|\bandhra pradesh\b/i.test(locLower))) {
    country = 'India';
  }

  if (!city && workMode === 'Remote' && country === 'India') {
    city = 'Remote India';
  } else if (!city && workMode === 'Remote') {
    city = 'Remote';
  }

  return {
    location: loc,
    city,
    state,
    country,
    workMode,
  };
}

export function inferCategoryName(title: string, rawCategory = '', description = ''): string {
  const text = `${title} ${rawCategory} ${description.slice(0, 500)}`.toLowerCase();

  const rules: Array<[RegExp, string]> = [
    [/\bvlsi\b|asic|rtl|verilog|systemverilog|fpga/i, 'VLSI Engineer'],
    [/embedded|firmware|rtos|microcontroller|stm32|arm cortex/i, 'Embedded Systems Engineer'],
    [/pcb|altium|kicad|schematic|orcad/i, 'PCB Design Engineer'],
    [/hardware engineer|board bring-up|analog design/i, 'Hardware Engineer'],
    [/robotics|ros2|mechatronics/i, 'Robotics Engineer'],
    [/electronics|electrical engineer|power electronics/i, 'Electronics Engineer'],
    [/mechanical engineer|cad|solidworks|autocad/i, 'Mechanical Engineer'],
    [/civil engineer|structural/i, 'Civil Engineer'],
    [/python/i, 'Python Developer'],
    [/react|next\.?js/i, 'React Developer'],
    [/angular/i, 'Angular Developer'],
    [/node\.?js|express/i, 'Node.js Developer'],
    [/full[\s-]?stack/i, 'Full Stack Developer'],
    [/front[\s-]?end|frontend/i, 'Frontend Developer'],
    [/back[\s-]?end|backend/i, 'Backend Developer'],
    [/java\b(?!script)/i, 'Java Developer'],
    [/javascript|typescript/i, 'JavaScript Developer'],
    [/flutter|dart/i, 'Flutter Developer'],
    [/android|kotlin/i, 'Android Developer'],
    [/ios\b|swift/i, 'iOS Developer'],
    [/\.net|c#|asp\.net/i, '.NET Developer'],
    [/php|laravel/i, 'PHP Developer'],
    [/erpnext|frappe/i, 'ERPNext Developer'],
    [/machine learning|ml engineer|pytorch|tensorflow/i, 'Machine Learning Engineer'],
    [/\bai\b|artificial intelligence|llm|generative ai/i, 'AI Engineer'],
    [/data scientist/i, 'Data Scientist'],
    [/data engineer|etl|spark|airflow|snowflake/i, 'Data Engineer'],
    [/data analyst|power bi|tableau|sql analyst/i, 'Data Analyst'],
    [/devops|kubernetes|docker|terraform|ci\/cd|sre/i, 'DevOps Engineer'],
    [/cloud engineer|aws|azure|gcp/i, 'Cloud Engineer'],
    [/cybersecurity|security engineer|soc analyst|penetration/i, 'Cybersecurity'],
    [/network engineer|cisco|routing/i, 'Network Engineer'],
    [/qa\b|quality assurance|automation test|selenium|playwright/i, 'QA Engineer'],
    [/tester|manual testing/i, 'Software Tester'],
    [/ui\/ux|ux designer|product designer|figma/i, 'UI/UX Designer'],
    [/technical support|it support|helpdesk/i, 'Technical Support'],
    [/government|sarkari|psu\b|upsc|ssc\b|ministry|public sector/i, 'Government Jobs'],
    [/railway|rrb\b/i, 'Railway Jobs'],
    [/banking|bank\b|ibps|rbi\b/i, 'Banking Jobs'],
    [/defence|army|navy|drdo|isro/i, 'Defence Jobs'],
    [/intern(ship)?/i, 'Internships'],
    [/apprentice/i, 'Apprenticeships'],
    [/part[\s-]?time/i, 'Part-Time'],
    [/walk[\s-]?in/i, 'Walk-in Interviews'],
    [/digital marketing|seo\b|sem\b|growth marketing/i, 'Digital Marketing'],
    [/marketing/i, 'Marketing Jobs'],
    [/sales|business development|account executive/i, 'Sales Jobs'],
    [/human resources|\bhr\b|recruiter|talent acquisition/i, 'HR Jobs'],
    [/accounting|chartered accountant|tally|bookkeeping/i, 'Accounting Jobs'],
    [/finance|financial analyst/i, 'Finance Jobs'],
    [/customer support|customer success|support specialist/i, 'Customer Support'],
    [/teaching|teacher|professor|lecturer|faculty/i, 'Teaching Jobs'],
    [/healthcare|nurse|doctor|pharma|medical/i, 'Healthcare Jobs'],
    [/legal|lawyer|counsel|compliance/i, 'Legal Jobs'],
    [/research|scientist|fellowship/i, 'Research Jobs'],
    [/software|developer|engineer|programmer/i, 'Software Developer'],
  ];

  for (const [regex, category] of rules) {
    if (regex.test(text)) {
      return category;
    }
  }

  return 'Software Developer';
}

export function inferEmploymentAndExperience(
  title: string,
  description: string,
  rawType = ''
): {
  employmentType: NormalizedJobInput['employmentType'];
  sector: 'Private' | 'Government';
  experienceLevel: NormalizedJobInput['experienceLevel'];
  experienceMin: number;
  experienceMax: number;
} {
  const combined = `${title} ${rawType} ${description.slice(0, 600)}`.toLowerCase();

  let employmentType: NormalizedJobInput['employmentType'] = 'Full-time';
  if (/intern/i.test(combined)) employmentType = 'Internship';
  else if (/apprentice/i.test(combined)) employmentType = 'Apprenticeship';
  else if (/part[\s-]?time/i.test(combined)) employmentType = 'Part-time';
  else if (/freelance/i.test(combined)) employmentType = 'Freelance';
  else if (/contract/i.test(combined)) employmentType = 'Contract';
  else if (/walk[\s-]?in/i.test(combined)) employmentType = 'Walk-in';

  const sector: 'Private' | 'Government' =
    /\bgovernment\b|\bpsu\b|\bministry\b|\brailway\b|\bdrdo\b|\bisro\b|\bnic\b|\bnational career/i.test(
      combined
    )
      ? 'Government'
      : 'Private';

  let experienceLevel: NormalizedJobInput['experienceLevel'] = '1-3 Years';
  let experienceMin = 1;
  let experienceMax = 3;

  if (/fresher|entry[\s-]?level|graduate trainee|junior|intern/i.test(combined)) {
    experienceLevel = 'Fresher';
    experienceMin = 0;
    experienceMax = 1;
  } else if (/0[\s-]*(to|-)[\s-]*1\s*year/i.test(combined)) {
    experienceLevel = '0-1 Years';
    experienceMin = 0;
    experienceMax = 1;
  } else if (/10\+\s*year|principal|vp\b|director|staff engineer/i.test(combined)) {
    experienceLevel = '10+ Years';
    experienceMin = 10;
    experienceMax = 15;
  } else if (/5[\s-]*(to|-)[\s-]*10\s*year|senior|lead|architect|manager/i.test(combined)) {
    experienceLevel = '5-10 Years';
    experienceMin = 5;
    experienceMax = 10;
  } else if (/3[\s-]*(to|-)[\s-]*5\s*year|mid[\s-]?level/i.test(combined)) {
    experienceLevel = '3-5 Years';
    experienceMin = 3;
    experienceMax = 5;
  }

  return {
    employmentType,
    sector,
    experienceLevel,
    experienceMin,
    experienceMax,
  };
}

export function extractSkillsFromText(title: string, description: string, tags: string[] = []): string[] {
  const knownSkills = [
    'Python', 'Java', 'JavaScript', 'TypeScript', 'React', 'Angular', 'Node.js',
    'SQL', 'PostgreSQL', 'MongoDB', 'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes',
    'Terraform', 'Django', 'FastAPI', 'Spring Boot', 'Flutter', 'Kotlin', 'Swift',
    '.NET', 'PHP', 'ERPNext', 'Frappe', 'Figma', 'Embedded C', 'RTOS', 'VLSI',
    'Verilog', 'SystemVerilog', 'PCB Design', 'MATLAB', 'AutoCAD', 'SolidWorks',
    'Machine Learning', 'PyTorch', 'TensorFlow', 'Selenium', 'Playwright', 'REST API',
    'GraphQL', 'Git', 'Linux', 'Cybersecurity', 'Data Analysis', 'Power BI', 'Tableau',
  ];

  const found = new Set<string>();
  for (const t of tags) {
    const clean = t.trim();
    if (clean.length >= 2 && clean.length <= 32) {
      found.add(clean);
    }
  }

  const haystack = `${title} ${description.slice(0, 2500)}`;
  for (const skill of knownSkills) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, 'i');
    if (regex.test(haystack)) {
      found.add(skill);
    }
  }

  return Array.from(found).slice(0, 10);
}
