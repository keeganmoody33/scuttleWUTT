import { db, products } from '@/db';
import { eq } from 'drizzle-orm';
import { calculateDaysSince } from '@/lib/utils';
import { logger } from '@/services/logger';

interface ScoringWeights {
  recency: number; // How recent is the launch
  socialProof: number; // Upvotes, comments, mentions
  quality: number; // Content quality, completeness
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  recency: 0.4,
  socialProof: 0.4,
  quality: 0.2,
};

/**
 * Calculate recency score (0-100)
 * Recent products get higher scores
 */
function calculateRecencyScore(launchDate: Date | null): number {
  if (!launchDate) return 0;

  const daysSince = calculateDaysSince(launchDate);

  // Score decays exponentially
  // 0 days = 100, 7 days = 50, 30 days = 10
  if (daysSince === 0) return 100;
  if (daysSince <= 7) return Math.max(50, 100 - daysSince * 7);
  if (daysSince <= 30) return Math.max(10, 50 - (daysSince - 7) * 1.7);
  return Math.max(0, 10 - (daysSince - 30) * 0.3);
}

/**
 * Calculate social proof score (0-100)
 * Based on upvotes, comments, mentions
 */
function calculateSocialProofScore(product: {
  upvotes: number | null;
  comments: number | null;
  mentions: number | null;
  stars: number | null;
}): number {
  const upvotes = product.upvotes || 0;
  const comments = product.comments || 0;
  const mentions = product.mentions || 0;
  const stars = product.stars || 0;

  // Weighted engagement score
  const engagement = upvotes * 1 + comments * 2 + mentions * 0.5 + stars * 0.1;

  // Normalize to 0-100 scale
  // 0 = 0, 100 = 50, 500+ = 100
  if (engagement === 0) return 0;
  if (engagement <= 100) return engagement;
  if (engagement <= 500) return 50 + ((engagement - 100) / 400) * 50;
  return 100;
}

/**
 * Calculate quality score (0-100)
 * Based on content completeness and richness
 */
function calculateQualityScore(product: {
  name: string;
  tagline: string | null;
  description: string | null;
  useCases: unknown;
  downsides: unknown;
  imageUrl: string | null;
  producerName: string | null;
  processed: boolean | null;
}): number {
  let score = 0;

  // Has basic info
  if (product.name) score += 10;
  if (product.tagline && product.tagline.length > 10) score += 15;
  if (product.description && product.description.length > 50) score += 15;
  if (product.imageUrl) score += 10;
  if (product.producerName) score += 10;

  // Has LLM-processed analysis
  if (product.processed) {
    score += 20;

    const useCases = product.useCases as string[] | null;
    const downsides = product.downsides as string[] | null;

    if (useCases && useCases.length >= 3) score += 10;
    if (downsides && downsides.length >= 2) score += 10;
  }

  return Math.min(100, score);
}

/**
 * Calculate overall product score
 */
export function calculateProductScore(
  product: {
    name: string;
    tagline: string | null;
    description: string | null;
    launchDate: Date | null;
    upvotes: number | null;
    comments: number | null;
    mentions: number | null;
    stars: number | null;
    useCases: unknown;
    downsides: unknown;
    imageUrl: string | null;
    producerName: string | null;
    processed: boolean | null;
  },
  weights: ScoringWeights = DEFAULT_WEIGHTS
): {
  recencyScore: number;
  socialProofScore: number;
  qualityScore: number;
  overallScore: number;
} {
  const recencyScore = calculateRecencyScore(product.launchDate);
  const socialProofScore = calculateSocialProofScore(product);
  const qualityScore = calculateQualityScore(product);

  const overallScore = Math.round(
    recencyScore * weights.recency +
    socialProofScore * weights.socialProof +
    qualityScore * weights.quality
  );

  return {
    recencyScore: Math.round(recencyScore),
    socialProofScore: Math.round(socialProofScore),
    qualityScore: Math.round(qualityScore),
    overallScore,
  };
}

/**
 * Score all products in the database
 */
export async function scoreProducts() {
  logger.info('Starting product scoring job');

  const allProducts = await db.query.products.findMany();

  logger.info('Products to score', { count: allProducts.length });

  for (const product of allProducts) {
    try {
      const scores = calculateProductScore(product);

      await db
        .update(products)
        .set({
          recencyScore: scores.recencyScore,
          relevanceScore: scores.socialProofScore, // Using this field for social proof
          qualityScore: scores.qualityScore,
          updatedAt: new Date(),
        })
        .where(eq(products.id, product.id));

      logger.debug('Product scored', {
        productId: product.id,
        productName: product.name,
        overallScore: scores.overallScore,
        recencyScore: scores.recencyScore,
        socialProofScore: scores.socialProofScore,
        qualityScore: scores.qualityScore,
      });
    } catch (err) {
      logger.error('Failed to score product', err as Error, { productId: product.id, productName: product.name });
    }
  }

  logger.info('Product scoring job completed', { totalProducts: allProducts.length });
}
