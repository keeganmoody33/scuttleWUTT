import { db, products, users, userPreferences, digests } from '@/db';
import { and, eq, gte, notInArray, sql } from 'drizzle-orm';
import { generateId } from '@/lib/utils';
import { Resend } from 'resend';
import { env } from '@/lib/env';
import { logger } from '@/services/logger';

const resend = new Resend(env.RESEND_API_KEY);

interface DigestProduct {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  url: string | null;
  imageUrl: string | null;
  producerName: string | null;
  producerUrl: string | null;
  launchDate: Date | null;
  upvotes: number | null;
  useCases: string[] | null;
  downsides: string[] | null;
  qualityScore: number | null;
}

/**
 * Get personalized product recommendations for a user
 */
export async function getPersonalizedProducts(
  userId: string,
  limit: number = 22
): Promise<DigestProduct[]> {
  // Get user preferences
  const prefs = await db.query.userPreferences.findFirst({
    where: (userPrefs, { eq }) => eq(userPrefs.userId, userId),
  });

  if (!prefs) {
    // No preferences set, return top products by quality score
    return db.query.products.findMany({
      where: (products, { eq }) => eq(products.processed, true),
      orderBy: (products, { desc }) => [desc(products.qualityScore)],
      limit,
    });
  }

  const userInterests = (prefs.interests as string[]) || [];
  const userCategories = (prefs.categories as string[]) || [];

  // Get products user has already seen in recent digests
  const recentDigests = await db.query.digests.findMany({
    where: (digests, { and, eq, gte }) =>
      and(
        eq(digests.userId, userId),
        gte(digests.sentAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
      ),
  });

  const seenProductIds = recentDigests.flatMap((d) => (d.productIds as string[]) || []);

  // Build relevance query
  // Products are relevant if their tags/categories overlap with user interests
  const relevantProducts = await db.query.products.findMany({
    where: (products, { and, eq, notInArray }) =>
      and(
        eq(products.processed, true),
        seenProductIds.length > 0 ? notInArray(products.id, seenProductIds) : undefined
      ),
    orderBy: (products, { desc }) => [
      desc(products.qualityScore),
      desc(products.recencyScore),
    ],
    limit: limit * 3, // Get more than we need for filtering
  });

  // Calculate relevance score for each product
  const scoredProducts = relevantProducts.map((product) => {
    const productTags = (product.tags as string[]) || [];
    const productCategories = (product.categories as string[]) || [];

    // Count overlaps
    const tagOverlap = productTags.filter((tag) =>
      userInterests.some((interest) => interest.toLowerCase() === tag.toLowerCase())
    ).length;

    const categoryOverlap = productCategories.filter((cat) =>
      userCategories.some((userCat) => userCat.toLowerCase() === cat.toLowerCase())
    ).length;

    const relevanceScore = tagOverlap * 2 + categoryOverlap * 3;

    return {
      ...product,
      relevanceScore,
      combinedScore: (product.qualityScore || 0) + relevanceScore * 10,
    };
  });

  // Sort by combined score and take top N
  scoredProducts.sort((a, b) => b.combinedScore - a.combinedScore);

  return scoredProducts.slice(0, limit).map(({ relevanceScore, combinedScore, ...product }) => product);
}

/**
 * Generate HTML email for digest
 */
function generateDigestEmail(
  userName: string | null,
  products: DigestProduct[]
): string {
  const appUrl = env.NEXT_PUBLIC_APP_URL || 'https://scuttlewhat.com';
  const productCards = products
    .map(
      (product) => `
    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: white;">
      ${
        product.imageUrl
          ? `<img src="${product.imageUrl}" alt="${product.name}" style="width: 100%; border-radius: 6px; margin-bottom: 12px;" />`
          : ''
      }

      <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">
        <a href="${product.url}" style="color: #1f2937; text-decoration: none;">${product.name}</a>
      </h3>

      ${product.tagline ? `<p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px;">${product.tagline}</p>` : ''}

      ${
        product.producerName
          ? `<p style="margin: 0 0 12px 0; font-size: 13px; color: #9ca3af;">
          by ${product.producerName}
        </p>`
          : ''
      }

      ${
        product.useCases && product.useCases.length > 0
          ? `
        <div style="margin-bottom: 12px;">
          <strong style="font-size: 13px; color: #374151;">Use Cases:</strong>
          <ul style="margin: 4px 0; padding-left: 20px; font-size: 13px; color: #4b5563;">
            ${product.useCases.map((uc) => `<li>${uc}</li>`).join('')}
          </ul>
        </div>
      `
          : ''
      }

      ${
        product.downsides && product.downsides.length > 0
          ? `
        <div style="margin-bottom: 12px;">
          <strong style="font-size: 13px; color: #374151;">Downsides:</strong>
          <ul style="margin: 4px 0; padding-left: 20px; font-size: 13px; color: #6b7280;">
            ${product.downsides.map((ds) => `<li>${ds}</li>`).join('')}
          </ul>
        </div>
      `
          : ''
      }

      <div style="display: flex; gap: 12px; font-size: 12px; color: #9ca3af;">
        ${product.upvotes ? `<span>👍 ${product.upvotes} upvotes</span>` : ''}
        ${product.launchDate ? `<span>🚀 ${product.launchDate.toLocaleDateString()}</span>` : ''}
      </div>
    </div>
  `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 24px;">
        <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #111827;">
          Scuttle What
        </h1>
        <p style="margin: 0 0 24px 0; color: #6b7280;">
          ${userName ? `Hey ${userName}! ` : ''}Your curated digest of the most promising new products
        </p>

        ${productCards}

        <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>Want to adjust your preferences? <a href="${appUrl}/settings" style="color: #3b82f6;">Update settings</a></p>
          <p>Don't want these emails? <a href="${appUrl}/unsubscribe" style="color: #6b7280;">Unsubscribe</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send digest to a user
 */
export async function sendDigestToUser(userId: string): Promise<void> {
  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, userId),
  });

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  const prefs = await db.query.userPreferences.findFirst({
    where: (userPrefs, { eq }) => eq(userPrefs.userId, userId),
  });

  if (!prefs?.emailEnabled) {
    logger.info('Skipping digest because email notifications disabled', { userId });
    return;
  }

  // Get personalized products
  const products = await getPersonalizedProducts(userId);

  if (products.length === 0) {
    logger.info('No personalized products found, skipping digest', { userId });
    return;
  }

  // Generate email
  const html = generateDigestEmail(user.name, products);

  // Send email
  await resend.emails.send({
    from: 'Scuttle What <digest@scuttlewhat.com>',
    to: user.email,
    subject: `${products.length} promising new products for you`,
    html,
  });

  // Record digest
  await db.insert(digests).values({
    id: generateId('digest'),
    userId,
    productIds: products.map((p) => p.id),
    sentAt: new Date(),
  });

  logger.info('Sent digest email', { email: user.email, productCount: products.length });
}

/**
 * Generate and send digests to all eligible users
 */
export async function generateDigestsForAllUsers(): Promise<void> {
  logger.info('Starting digest generation job');

  const allUsers = await db.query.users.findMany({
    with: {
      preferences: true,
      digests: {
        orderBy: (digests, { desc }) => [desc(digests.sentAt)],
        limit: 1,
      },
    },
  });

  for (const user of allUsers) {
    try {
      const prefs = user.preferences;
      if (!prefs || !prefs.emailEnabled) {
        continue;
      }

      // Check if user should receive digest based on frequency
      const lastDigest = user.digests[0];
      const now = new Date();

      let shouldSend = false;

      if (!lastDigest) {
        shouldSend = true;
      } else {
        const daysSinceLastDigest = Math.floor(
          (now.getTime() - lastDigest.sentAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        switch (prefs.updateFrequency) {
          case 'daily':
            shouldSend = daysSinceLastDigest >= 1;
            break;
          case 'weekly':
            shouldSend = daysSinceLastDigest >= 7;
            break;
          case 'biweekly':
            shouldSend = daysSinceLastDigest >= 14;
            break;
          case 'on_demand':
            shouldSend = false; // Don't auto-send
            break;
        }
      }

      if (shouldSend) {
        await sendDigestToUser(user.id);
      }
    } catch (err) {
      logger.error('Failed to send digest to user', err, { userId: user.id });
    }
  }

  logger.info('Digest generation job finished');
}
