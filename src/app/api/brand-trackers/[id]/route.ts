import { NextRequest, NextResponse } from 'next/server';
import { db, brandTrackers } from '@/db';
import { eq } from 'drizzle-orm';
import { trackBrand } from '@/services/brand-tracking';
import { authorizeRequest } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { logger } from '@/services/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for multi-model tracking

/**
 * GET /api/brand-trackers/[id]
 * Get a specific brand tracker
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
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

        const { id } = params;

        const tracker = await db.query.brandTrackers.findFirst({
            where: (trackers, { eq }) => eq(trackers.id, id),
        });

        if (!tracker) {
            return NextResponse.json(
                { error: 'Brand tracker not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ tracker });
    } catch (error) {
        logger.error('Error fetching brand tracker', error);

        return NextResponse.json(
            {
                error: 'Failed to fetch brand tracker',
                details: 'Please try again later.',
            },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/brand-trackers/[id]
 * Refresh/update a brand tracker (run tracking analysis)
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { authorized, reason } = authorizeRequest(request);
        if (!authorized) {
            return NextResponse.json({ error: reason || 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = enforceRateLimit(request, 'api:brand-trackers:update');
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Too many refresh attempts. Please try again later.' },
                { status: 429, headers: { 'Retry-After': Math.ceil(rateLimit.resetInMs / 1000).toString() } }
            );
        }

        const { id } = params;

        // Get the existing tracker
        const existing = await db
            .select()
            .from(brandTrackers)
            .where(eq(brandTrackers.id, id))
            .limit(1);

        if (existing.length === 0) {
            return NextResponse.json(
                { error: 'Brand tracker not found' },
                { status: 404 }
            );
        }

        const tracker = existing[0];

        if (!tracker.active) {
            return NextResponse.json(
                { error: 'Brand tracker is inactive' },
                { status: 400 }
            );
        }

        logger.info('Refreshing brand tracker', { trackerId: id, brandName: tracker.brandName });

        // Run brand tracking analysis
        const snapshots = await trackBrand(id, tracker.brandName, tracker.trackedPrompts as string[]);

        // Return updated tracker
        const updated = await db
            .select()
            .from(brandTrackers)
            .where(eq(brandTrackers.id, id))
            .limit(1);

        return NextResponse.json({
            tracker: updated[0],
            snapshots,
            message: 'Brand tracker refreshed successfully',
        });
    } catch (error) {
        logger.error('Error updating brand tracker', error);

        return NextResponse.json(
            {
                error: 'Failed to update brand tracker',
                details: 'Please try again later.',
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/brand-trackers/[id]
 * Delete a brand tracker
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { authorized, reason } = authorizeRequest(request);
        if (!authorized) {
            return NextResponse.json({ error: reason || 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = enforceRateLimit(request, 'api:brand-trackers:delete');
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Too many delete attempts.' },
                { status: 429, headers: { 'Retry-After': Math.ceil(rateLimit.resetInMs / 1000).toString() } }
            );
        }

        const { id } = params;

        // Check if tracker exists
        const existing = await db
            .select()
            .from(brandTrackers)
            .where(eq(brandTrackers.id, id))
            .limit(1);

        if (existing.length === 0) {
            return NextResponse.json(
                { error: 'Brand tracker not found' },
                { status: 404 }
            );
        }

        // Delete the tracker
        await db
            .delete(brandTrackers)
            .where(eq(brandTrackers.id, id));

        logger.info('Brand tracker deleted successfully', { trackerId: id });

        return NextResponse.json({
            message: 'Brand tracker deleted successfully',
        });
    } catch (error) {
        logger.error('Error deleting brand tracker', error);

        return NextResponse.json(
            {
                error: 'Failed to delete brand tracker',
                details: 'Please try again later.',
            },
            { status: 500 }
        );
    }
}

