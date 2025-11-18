import { NextRequest, NextResponse } from 'next/server';
import { db, brandTrackers } from '@/db';
import { generateId } from '@/lib/utils';
import { z } from 'zod';
import { authorizeRequest } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { logger } from '@/services/logger';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CreateTrackerSchema = z.object({
    brandName: z.string().min(2, 'Brand name must be at least 2 characters'),
    trackedPrompts: z.array(z.string().min(5, 'Each prompt must be at least 5 characters')).min(1, 'At least one prompt is required'),
    userId: z.string().optional(), // For now, allow anonymous tracking
    checkFrequencyDays: z.number().int().min(1).max(30).default(1),
});

/**
 * GET /api/brand-trackers
 * List all brand trackers for the current user
 */
export async function GET(request: NextRequest) {
    try {
        const { authorized, reason } = authorizeRequest(request);
        if (!authorized) {
            return NextResponse.json({ error: reason || 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = enforceRateLimit(request, 'api:brand-trackers:get');
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please slow down.' },
                { status: 429, headers: { 'Retry-After': Math.ceil(rateLimit.resetInMs / 1000).toString() } }
            );
        }

        // TODO: Add authentication and filter by user
        // For MVP, return all trackers
        const allTrackers = await db
            .select()
            .from(brandTrackers)
            .orderBy(brandTrackers.createdAt);

        return NextResponse.json({
            trackers: allTrackers,
        });
    } catch (error) {
        logger.error('Error fetching brand trackers', error as Error);

        return NextResponse.json(
            {
                error: 'Failed to fetch brand trackers',
                details: 'Please try again later.',
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/brand-trackers
 * Create a new brand tracker
 */
export async function POST(request: NextRequest) {
    try {
        const { authorized, reason } = authorizeRequest(request);
        if (!authorized) {
            return NextResponse.json({ error: reason || 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = enforceRateLimit(request, 'api:brand-trackers:post');
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Too many tracker creations. Please wait.' },
                { status: 429, headers: { 'Retry-After': Math.ceil(rateLimit.resetInMs / 1000).toString() } }
            );
        }

        const body = await request.json();
        const validatedData = CreateTrackerSchema.parse(body);

        const { brandName, trackedPrompts, checkFrequencyDays } = validatedData;

        logger.info('Creating brand tracker', { brandName, promptCount: trackedPrompts.length });

        const trackerId = generateId('brand');
        const now = new Date();
        const nextCheck = new Date(now.getTime() + checkFrequencyDays * 24 * 60 * 60 * 1000);

        await db.insert(brandTrackers).values({
            id: trackerId,
            userId: validatedData.userId || 'anonymous', // TODO: Use real user ID
            brandName,
            trackedPrompts,
            shareOfVoice: 0,
            sentimentScore: 50,
            consensusScore: 0,
            providerBias: [],
            alertsEnabled: true,
            alertThreshold: 10,
            checkFrequencyDays,
            lastCheckedAt: null,
            nextCheckAt: nextCheck,
            active: true,
            createdAt: now,
            updatedAt: now,
        });

        logger.info('Brand tracker created successfully', { trackerId, brandName });

        // Return the created tracker
        const tracker = await db
            .select()
            .from(brandTrackers)
            .where(eq(brandTrackers.id, trackerId))
            .limit(1);

        return NextResponse.json({
            tracker: tracker[0],
            message: 'Brand tracker created successfully',
        });
    } catch (error) {
        logger.error('Error creating brand tracker', error as Error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    error: 'Invalid input',
                    details: error.errors.map((e) => e.message).join(', '),
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                error: 'Failed to create brand tracker',
                details: 'Please try again later.',
            },
            { status: 500 }
        );
    }
}

