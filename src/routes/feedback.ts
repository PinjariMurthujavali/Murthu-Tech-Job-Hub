import { desc, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { feedback } from '../db/schema.ts';
import { type AuthRequest, optionalAuth } from '../middleware/auth.ts';

const router = Router();

router.post('/', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().email().optional().or(z.literal('')),
      type: z.enum([
        'Suggestion',
        'Complaint',
        'Feature Request',
        'General Experience',
        'Contact Inquiry',
      ]),
      rating: z.number().int().min(1).max(5),
      message: z.string().trim().min(5).max(2000),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message || 'Invalid feedback submission.' });
    }

    const [created] = await db
      .insert(feedback)
      .values({
        userId: req.authUser?.id || null,
        name: parsed.data.name,
        email: parsed.data.email || req.authUser?.email || null,
        type: parsed.data.type,
        rating: parsed.data.rating,
        message: parsed.data.message,
        status: 'NEW',
      })
      .returning();

    res.status(201).json({
      feedback: created,
      message: 'Thank you for sharing your feedback with MURTHU JOB HUB.',
    });
  } catch (err) {
    console.error('Feedback submit error:', err);
    res.status(500).json({ error: 'Failed to submit feedback.' });
  }
});

router.get('/public', async (_req, res) => {
  try {
    const [summary] = await db
      .select({
        totalCount: sql<number>`COUNT(*)`,
        avgRating: sql<number>`ROUND(COALESCE(AVG(${feedback.rating}), 0), 1)`,
      })
      .from(feedback);

    const recent = await db
      .select({
        id: feedback.id,
        name: feedback.name,
        type: feedback.type,
        rating: feedback.rating,
        message: feedback.message,
        adminResponse: feedback.adminResponse,
        createdAt: feedback.createdAt,
      })
      .from(feedback)
      .orderBy(desc(feedback.createdAt))
      .limit(8);

    res.json({
      totalCount: Number(summary?.totalCount || 0),
      avgRating: Number(summary?.avgRating || 0),
      recent,
    });
  } catch (err) {
    console.error('Public feedback error:', err);
    res.status(500).json({ error: 'Failed to fetch feedback summary.' });
  }
});

export default router;
