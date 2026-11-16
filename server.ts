import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import { jobCategories, jobs } from './src/db/schema.ts';
import adminRouter from './src/routes/admin.ts';
import authRouter from './src/routes/auth.ts';
import feedbackRouter from './src/routes/feedback.ts';
import jobsRouter from './src/routes/jobs.ts';
import userRouter from './src/routes/user.ts';
import { startBackgroundScheduler } from './src/services/scheduler.ts';

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      frameguard: false,
    })
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', apiLimiter);

  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));

  // Public health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'MURTHU JOB HUB', timestamp: new Date().toISOString() });
  });

  // REST API routes
  app.use('/api/auth', authRouter);
  app.use('/api/jobs', jobsRouter);
  app.use('/api/user', userRouter);
  app.use('/api/feedback', feedbackRouter);
  app.use('/api/admin', adminRouter);

  // SEO robots.txt & dynamic sitemap.xml
  app.get('/robots.txt', (req, res) => {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /dashboard\nDisallow: /api/\nSitemap: ${baseUrl}/sitemap.xml\n`
    );
  });

  app.get('/sitemap.xml', async (req, res) => {
    try {
      const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(
        /\/$/,
        ''
      );
      const staticRoutes = [
        '/',
        '/jobs',
        '/hyderabad-jobs',
        '/categories',
        '/feedback',
        '/about',
        '/contact',
        '/privacy',
        '/terms',
      ];

      const [cats, activeJobs] = await Promise.all([
        db.select({ slug: jobCategories.slug }).from(jobCategories).limit(120),
        db
          .select({ slug: jobs.slug, updatedAt: jobs.updatedAt })
          .from(jobs)
          .where(
            and(
              eq(jobs.isDeleted, false),
              inArray(jobs.verificationStatus, ['LIVE VERIFIED', 'UNVERIFIED', 'UNDER REVIEW'])
            )
          )
          .orderBy(desc(jobs.updatedAt))
          .limit(300),
      ]);

      const urls = [
        ...staticRoutes.map((r) => `<url><loc>${baseUrl}${r}</loc><changefreq>daily</changefreq></url>`),
        ...cats.map(
          (c) =>
            `<url><loc>${baseUrl}/jobs?category=${encodeURIComponent(c.slug)}</loc><changefreq>daily</changefreq></url>`
        ),
        ...activeJobs.map(
          (j) =>
            `<url><loc>${baseUrl}/jobs/${encodeURIComponent(j.slug)}</loc><lastmod>${j.updatedAt.toISOString()}</lastmod><changefreq>daily</changefreq></url>`
        ),
      ];

      res.type('application/xml').send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join(
          '\n'
        )}\n</urlset>`
      );
    } catch {
      res.status(500).type('text/plain').send('Failed to generate sitemap');
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MURTHU JOB HUB listening on http://0.0.0.0:${PORT}`);
    startBackgroundScheduler();
  });
}

startServer().catch((err) => {
  console.error('Failed to start MURTHU JOB HUB server:', err);
  process.exit(1);
});
