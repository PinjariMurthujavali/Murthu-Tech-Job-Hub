import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    name: text('name').notNull().default('Candidate'),
    role: text('role').notNull().default('user'),
    isSuspended: boolean('is_suspended').notNull().default(false),
    emailVerified: boolean('email_verified').notNull().default(false),
    resetToken: text('reset_token'),
    resetTokenExpiresAt: timestamp('reset_token_expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('users_email_idx').on(table.email)]
);

export const userProfiles = pgTable('user_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  phone: text('phone'),
  headline: text('headline'),
  qualification: text('qualification'),
  experienceYears: text('experience_years'),
  skills: jsonb('skills').$type<string[]>().notNull().default([]),
  preferredLocation: text('preferred_location'),
  preferredCategories: jsonb('preferred_categories').$type<string[]>().notNull().default([]),
  resumeFilename: text('resume_filename'),
  resumeUrl: text('resume_url'),
  bio: text('bio'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const companies = pgTable(
  'companies',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    website: text('website'),
    logoUrl: text('logo_url'),
    industry: text('industry'),
    headquarters: text('headquarters'),
    isVerified: boolean('is_verified').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('companies_name_idx').on(table.name)]
);

export const jobSources = pgTable('job_sources', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  sourceType: text('source_type').notNull().default('api'),
  endpointUrl: text('endpoint_url'),
  isEnabled: boolean('is_enabled').notNull().default(true),
  status: text('status').notNull().default('ACTIVE'),
  statusMessage: text('status_message'),
  lastSyncAt: timestamp('last_sync_at'),
  lastSuccessAt: timestamp('last_success_at'),
  lastError: text('last_error'),
  jobsImportedCount: integer('jobs_imported_count').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const jobCategories = pgTable(
  'job_categories',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(),
    slug: text('slug').notNull().unique(),
    groupName: text('group_name').notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('job_categories_group_idx').on(table.groupName)]
);

export const jobSubcategories = pgTable('job_subcategories', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id')
    .references(() => jobCategories.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const jobs = pgTable(
  'jobs',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    sourceId: integer('source_id')
      .references(() => jobSources.id)
      .notNull(),
    sourceName: text('source_name').notNull(),
    externalJobId: text('external_job_id').notNull(),
    fingerprint: text('fingerprint').notNull().unique(),
    title: text('title').notNull(),
    companyId: integer('company_id').references(() => companies.id),
    companyName: text('company_name').notNull(),
    categoryId: integer('category_id').references(() => jobCategories.id),
    categoryName: text('category_name').notNull(),
    subcategoryName: text('subcategory_name'),
    description: text('description').notNull(),
    qualifications: text('qualifications'),
    location: text('location').notNull(),
    city: text('city'),
    state: text('state'),
    country: text('country').notNull().default('India'),
    pincode: text('pincode'),
    workMode: text('work_mode').notNull().default('Office'),
    employmentType: text('employment_type').notNull().default('Full-time'),
    sector: text('sector').notNull().default('Private'),
    experienceLevel: text('experience_level').notNull().default('1-3 Years'),
    experienceMin: integer('experience_min').notNull().default(0),
    experienceMax: integer('experience_max').notNull().default(3),
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    salaryCurrency: text('salary_currency').notNull().default('INR'),
    salaryDisplay: text('salary_display'),
    applyUrl: text('apply_url').notNull(),
    verificationStatus: text('verification_status').notNull().default('UNVERIFIED'),
    validationPriority: integer('validation_priority').notNull().default(0),
    validationFailures: integer('validation_failures').notNull().default(0),
    lastVerifiedAt: timestamp('last_verified_at'),
    postedAt: timestamp('posted_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at'),
    isFeatured: boolean('is_featured').notNull().default(false),
    clickCount: integer('click_count').notNull().default(0),
    reportCount: integer('report_count').notNull().default(0),
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('jobs_source_external_uniq').on(table.sourceName, table.externalJobId),
    index('jobs_status_idx').on(table.verificationStatus),
    index('jobs_city_idx').on(table.city),
    index('jobs_category_idx').on(table.categoryName),
    index('jobs_posted_idx').on(table.postedAt),
    index('jobs_sector_idx').on(table.sector),
  ]
);

export const jobSkills = pgTable(
  'job_skills',
  {
    id: serial('id').primaryKey(),
    jobId: integer('job_id')
      .references(() => jobs.id, { onDelete: 'cascade' })
      .notNull(),
    skillName: text('skill_name').notNull(),
  },
  (table) => [index('job_skills_job_idx').on(table.jobId)]
);

export const savedJobs = pgTable(
  'saved_jobs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    jobId: integer('job_id')
      .references(() => jobs.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('saved_jobs_user_job_uniq').on(table.userId, table.jobId)]
);

export const viewedJobs = pgTable(
  'viewed_jobs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    jobId: integer('job_id')
      .references(() => jobs.id, { onDelete: 'cascade' })
      .notNull(),
    viewedAt: timestamp('viewed_at').defaultNow().notNull(),
  },
  (table) => [index('viewed_jobs_user_idx').on(table.userId)]
);

export const jobReports = pgTable(
  'job_reports',
  {
    id: serial('id').primaryKey(),
    jobId: integer('job_id')
      .references(() => jobs.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    reporterEmail: text('reporter_email'),
    category: text('category').notNull(),
    description: text('description').notNull(),
    evidenceUrl: text('evidence_url'),
    status: text('status').notNull().default('OPEN'),
    adminNotes: text('admin_notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at'),
  },
  (table) => [index('job_reports_job_idx').on(table.jobId)]
);

export const feedback = pgTable('feedback', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  email: text('email'),
  type: text('type').notNull(),
  rating: integer('rating').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('NEW'),
  adminResponse: text('admin_response'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const jobAlerts = pgTable(
  'job_alerts',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    keywords: text('keywords'),
    location: text('location'),
    category: text('category'),
    experienceLevel: text('experience_level'),
    workMode: text('work_mode'),
    sector: text('sector'),
    emailEnabled: boolean('email_enabled').notNull().default(true),
    inAppEnabled: boolean('in_app_enabled').notNull().default(true),
    isActive: boolean('is_active').notNull().default(true),
    lastTriggeredAt: timestamp('last_triggered_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('job_alerts_user_idx').on(table.userId)]
);

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    alertId: integer('alert_id').references(() => jobAlerts.id, { onDelete: 'set null' }),
    jobId: integer('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    message: text('message').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    dedupeKey: text('dedupe_key').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('notifications_user_idx').on(table.userId)]
);

export const applicationClicks = pgTable(
  'application_clicks',
  {
    id: serial('id').primaryKey(),
    jobId: integer('job_id')
      .references(() => jobs.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    sourceName: text('source_name').notNull(),
    referrer: text('referrer'),
    clickedAt: timestamp('clicked_at').defaultNow().notNull(),
  },
  (table) => [index('application_clicks_job_idx').on(table.jobId)]
);

export const syncLogs = pgTable(
  'sync_logs',
  {
    id: serial('id').primaryKey(),
    sourceId: integer('source_id')
      .references(() => jobSources.id, { onDelete: 'cascade' })
      .notNull(),
    sourceName: text('source_name').notNull(),
    status: text('status').notNull(),
    jobsFetched: integer('jobs_fetched').notNull().default(0),
    jobsInserted: integer('jobs_inserted').notNull().default(0),
    duplicatesSkipped: integer('duplicates_skipped').notNull().default(0),
    errorMessage: text('error_message'),
    durationMs: integer('duration_ms').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('sync_logs_source_idx').on(table.sourceId)]
);

export const validationLogs = pgTable(
  'validation_logs',
  {
    id: serial('id').primaryKey(),
    jobId: integer('job_id')
      .references(() => jobs.id, { onDelete: 'cascade' })
      .notNull(),
    previousStatus: text('previous_status').notNull(),
    newStatus: text('new_status').notNull(),
    httpStatus: integer('http_status'),
    checkOutcome: text('check_outcome').notNull(),
    details: text('details'),
    checkedAt: timestamp('checked_at').defaultNow().notNull(),
  },
  (table) => [index('validation_logs_job_idx').on(table.jobId)]
);

export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  email: text('email').notNull().unique(),
  role: text('role').notNull().default('SUPER_ADMIN'),
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  savedJobs: many(savedJobs),
  viewedJobs: many(viewedJobs),
  jobAlerts: many(jobAlerts),
  notifications: many(notifications),
  jobReports: many(jobReports),
  feedbackList: many(feedback),
  adminRecord: one(adminUsers, {
    fields: [users.id],
    references: [adminUsers.userId],
  }),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  source: one(jobSources, {
    fields: [jobs.sourceId],
    references: [jobSources.id],
  }),
  company: one(companies, {
    fields: [jobs.companyId],
    references: [companies.id],
  }),
  category: one(jobCategories, {
    fields: [jobs.categoryId],
    references: [jobCategories.id],
  }),
  skills: many(jobSkills),
  reports: many(jobReports),
  validationLogs: many(validationLogs),
}));

export const jobSkillsRelations = relations(jobSkills, ({ one }) => ({
  job: one(jobs, {
    fields: [jobSkills.jobId],
    references: [jobs.id],
  }),
}));

export const jobCategoriesRelations = relations(jobCategories, ({ many }) => ({
  subcategories: many(jobSubcategories),
}));

export const jobSubcategoriesRelations = relations(jobSubcategories, ({ one }) => ({
  category: one(jobCategories, {
    fields: [jobSubcategories.categoryId],
    references: [jobCategories.id],
  }),
}));
