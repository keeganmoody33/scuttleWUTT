import { db, brandTrackers } from '@/db';
import { answerQuestion } from '@/services/question-answering';
import { compareModelResponses } from '@/services/model-comparison';
import { callLLM, type LLMModel, getAvailableModels, getModelMetadata } from '@/services/llm';
import { logger } from '@/services/logger';
import { generateId } from '@/lib/utils';
import { eq } from 'drizzle-orm';

export interface BrandMention {
    model: LLMModel;
    provider: string;
    mentioned: boolean;
    rank?: number; // Position in recommendations (1-based)
    sentiment: 'positive' | 'neutral' | 'negative';
    context?: string; // Snippet of text mentioning the brand
}

export interface BrandSnapshot {
    trackerId: string;
    prompt: string;
    mentions: BrandMention[];
    shareOfVoice: number; // % of models that mentioned the brand
    sentimentScore: number; // 0-100, weighted by sentiment
    consensusScore: number; // How much models agree
    providerBias: Array<{
        provider: string;
        sentiment: number; // -10 to +10
        shareOfVoice: number; // 0-100
    }>;
    timestamp: Date;
}

/**
 * Track a brand across multiple prompts and models
 */
export async function trackBrand(
    trackerId: string,
    brandName: string,
    prompts: string[]
): Promise<BrandSnapshot[]> {
    const tracker = await db.query.brandTrackers.findFirst({
        where: (trackers, { eq }) => eq(trackers.id, trackerId),
    });

    if (!tracker) {
        throw new Error(`Brand tracker ${trackerId} not found`);
    }

    logger.info('Starting brand tracking', { trackerId, brandName, promptCount: prompts.length });

    const snapshots: BrandSnapshot[] = [];

    // Use a subset of high-quality models for brand tracking
    const models: LLMModel[] = [
        'claude-sonnet-4-5',
        'gpt-4o',
        'deepseek-chat',
        'gemini-1.5-pro',
    ].filter((m) => m !== 'gemini-1.5-pro') as LLMModel[]; // Filter out Gemini if not available

    for (const prompt of prompts) {
        logger.debug('Tracking brand for prompt', { trackerId, brandName, prompt });

        const mentions: BrandMention[] = [];

        // Query all models in parallel
        const responses = await Promise.allSettled(
            models.map(async (model) => {
                try {
                    const answer = await answerQuestion(prompt, model);
                    return {
                        model,
                        answer,
                        success: true,
                    };
                } catch (error) {
                    logger.warn('Model call failed during brand tracking', { model, prompt, error });
                    return {
                        model,
                        answer: null,
                        success: false,
                    };
                }
            })
        );

        // Process each response to find brand mentions
        for (const response of responses) {
            if (response.status === 'fulfilled' && response.value.success && response.value.answer) {
                const { model, answer } = response.value;
                const metadata = getModelMetadata(model);
                const tools = answer.tools || [];

                // Check if brand is mentioned in any tool
                const brandToolIndex = tools.findIndex((tool: any) =>
                    tool.name.toLowerCase().includes(brandName.toLowerCase())
                );

                if (brandToolIndex !== -1) {
                    const tool = tools[brandToolIndex];
                    const rank = brandToolIndex + 1;

                    // Determine sentiment from description and downside
                    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
                    const description = (tool.description || '').toLowerCase();
                    const downside = (tool.downside || '').toLowerCase();
                    const brandLower = brandName.toLowerCase();

                    if (description.includes(brandLower)) {
                        // Check for positive indicators
                        if (
                            description.includes('best') ||
                            description.includes('leading') ||
                            description.includes('popular') ||
                            description.includes('recommended')
                        ) {
                            sentiment = 'positive';
                        } else if (
                            downside.includes('expensive') ||
                            downside.includes('complex') ||
                            downside.includes('limited')
                        ) {
                            sentiment = 'negative';
                        }
                    }

                    mentions.push({
                        model,
                        provider: metadata.provider,
                        mentioned: true,
                        rank,
                        sentiment,
                        context: tool.description?.substring(0, 100),
                    });
                } else {
                    // Brand not mentioned
                    const metadata = getModelMetadata(model);
                    mentions.push({
                        model,
                        provider: metadata.provider,
                        mentioned: false,
                        sentiment: 'neutral',
                    });
                }
            } else {
                // Model call failed
                const model = response.status === 'fulfilled' ? response.value.model : 'unknown';
                mentions.push({
                    model: model as LLMModel,
                    provider: 'unknown',
                    mentioned: false,
                    sentiment: 'neutral',
                });
            }
        }

        // Calculate metrics
        const mentionedCount = mentions.filter((m) => m.mentioned).length;
        const shareOfVoice = Math.round((mentionedCount / mentions.length) * 100);

        // Calculate sentiment score (0-100)
        let sentimentScore = 50; // Neutral baseline
        const positiveMentions = mentions.filter((m) => m.mentioned && m.sentiment === 'positive').length;
        const negativeMentions = mentions.filter((m) => m.mentioned && m.sentiment === 'negative').length;
        const totalMentions = positiveMentions + negativeMentions;

        if (totalMentions > 0) {
            // Weighted sentiment: positive = +50, negative = -50, neutral = 0
            sentimentScore = Math.round(
                50 + ((positiveMentions - negativeMentions) / totalMentions) * 50
            );
            sentimentScore = Math.max(0, Math.min(100, sentimentScore));
        }

        // Calculate consensus score (how much models agree)
        const consensusScore = shareOfVoice; // Simple: higher share = higher consensus

        // Calculate provider bias
        const providerGroups = new Map<string, { mentions: number; positive: number; negative: number; total: number }>();

        for (const mention of mentions) {
            if (!providerGroups.has(mention.provider)) {
                providerGroups.set(mention.provider, { mentions: 0, positive: 0, negative: 0, total: 0 });
            }
            const group = providerGroups.get(mention.provider)!;
            group.total++;
            if (mention.mentioned) {
                group.mentions++;
                if (mention.sentiment === 'positive') group.positive++;
                if (mention.sentiment === 'negative') group.negative++;
            }
        }

        const providerBias = Array.from(providerGroups.entries()).map(([provider, stats]) => {
            const providerShare = stats.total > 0 ? (stats.mentions / stats.total) * 100 : 0;
            const providerSentiment =
                stats.mentions > 0
                    ? ((stats.positive - stats.negative) / stats.mentions) * 10
                    : 0; // -10 to +10 scale

            return {
                provider,
                sentiment: Math.round(providerSentiment * 10) / 10, // Round to 1 decimal
                shareOfVoice: Math.round(providerShare),
            };
        });

        snapshots.push({
            trackerId,
            prompt,
            mentions,
            shareOfVoice,
            sentimentScore,
            consensusScore,
            providerBias,
            timestamp: new Date(),
        });
    }

    // Calculate aggregate metrics across all prompts
    const aggregateShareOfVoice = Math.round(
        snapshots.reduce((sum, s) => sum + s.shareOfVoice, 0) / snapshots.length
    );
    const aggregateSentimentScore = Math.round(
        snapshots.reduce((sum, s) => sum + s.sentimentScore, 0) / snapshots.length
    );
    const aggregateConsensusScore = Math.round(
        snapshots.reduce((sum, s) => sum + s.consensusScore, 0) / snapshots.length
    );

    // Aggregate provider bias across all prompts
    const aggregateProviderBias = new Map<string, { sentiment: number; shareOfVoice: number; count: number }>();

    for (const snapshot of snapshots) {
        for (const bias of snapshot.providerBias) {
            if (!aggregateProviderBias.has(bias.provider)) {
                aggregateProviderBias.set(bias.provider, { sentiment: 0, shareOfVoice: 0, count: 0 });
            }
            const agg = aggregateProviderBias.get(bias.provider)!;
            agg.sentiment += bias.sentiment;
            agg.shareOfVoice += bias.shareOfVoice;
            agg.count++;
        }
    }

    const finalProviderBias = Array.from(aggregateProviderBias.entries()).map(([provider, agg]) => ({
        provider,
        sentiment: Math.round((agg.sentiment / agg.count) * 10) / 10,
        shareOfVoice: Math.round(agg.shareOfVoice / agg.count),
    }));

    // Update tracker with aggregate metrics
    const now = new Date();
    const nextCheck = new Date(now.getTime() + tracker.checkFrequencyDays * 24 * 60 * 60 * 1000);

    await db
        .update(brandTrackers)
        .set({
            shareOfVoice: aggregateShareOfVoice,
            sentimentScore: aggregateSentimentScore,
            consensusScore: aggregateConsensusScore,
            providerBias: finalProviderBias,
            lastCheckedAt: now,
            nextCheckAt: nextCheck,
            updatedAt: now,
        })
        .where(eq(brandTrackers.id, trackerId));

    logger.info('Brand tracking completed', {
        trackerId,
        brandName,
        shareOfVoice: aggregateShareOfVoice,
        sentimentScore: aggregateSentimentScore,
    });

    return snapshots;
}


