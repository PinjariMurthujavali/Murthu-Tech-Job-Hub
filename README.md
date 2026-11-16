# MURTHU JOB HUB

**One Platform. Thousands of Opportunities. One Dream Career.**

A full-stack job discovery, live URL verification, and career tracking portal built with React, TypeScript, Tailwind CSS, Express, Drizzle ORM, PostgreSQL (Cloud SQL), and Firebase Authentication.

## Architecture & Features

- **Real Multi-Source Job Aggregation**:
  - **SerpApi Google Jobs (`https://serpapi.com/google-jobs-api`)**: Set `SERPAPI_API_KEY` to import live Indian & international listings aggregated from LinkedIn, Naukri, Indeed, Glassdoor, Foundit, and company career pages.
  - **Active Public Job APIs**: Remotive, Arbeitnow, Jobicy, and The Muse run out-of-the-box without requiring paid keys.
  - **Adzuna India**: Set `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` to enable.
- **Automatic Live Job Validation Engine**: Periodically checks original `applyUrl` endpoints, marks confirmed active listings as `LIVE VERIFIED`, moves closed roles out of active search results, archives expired roles, and preserves status during transient network errors.
- **Candidate Dashboard**: Google Sign-In + Email/Password accounts, resume upload (PDF/DOC/DOCX), saved jobs, recently viewed history, personalized job alerts, and notification inbox.
- **Admin Control Panel**: Protected RBAC admin console (`ADMIN_EMAILS` / `admin_users`) for manual verified job publishing, source sync, custom SerpApi queries, report investigation, category CRUD, user moderation, and sync/validation logs.

## Environment Variables

See `.env.example` for all supported variables:
- `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD` (managed automatically by Cloud SQL in AI Studio)
- `SERPAPI_API_KEY` (optional, enables SerpApi Google Jobs)
- `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` (optional, enables Adzuna India)
- `SESSION_SECRET` (signing secret for email/password sessions)
- `ADMIN_EMAILS` (comma-separated admin emails, defaults to `luckymurthu@gmail.com`)

## GitHub & Netlify Deployment

1. Push this repository to GitHub.
2. For full-stack Node.js + PostgreSQL hosting, deploy to Google Cloud Run / Railway / Render using `npm run build` and `npm start` (`node server.ts`).
3. If deploying the frontend on **Netlify**, `netlify.toml` is included (`npm run build`, publish directory `dist`, SPA redirect rules). Configure a `/api/*` proxy rule in `netlify.toml` pointing to your live backend URL.
