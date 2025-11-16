/**
 * Signal 1: Market Intent (Demand Proxy)
 *
 * Tracks public search volume as a proxy for market demand.
 * Integrates with Google Trends, Semrush, or similar APIs.
 *
 * This is the "transparency" layer - we show users WHERE the data comes from.
 */

export interface DemandSignal {
  keywords: string[];
  intentScore: number; // 0-100, normalized search volume
  trend: 'rising' | 'falling' | 'flat';
  velocity: number; // % change month-over-month
  source: 'google_trends' | 'semrush' | 'ahrefs' | 'manual';
  lastUpdated: Date;
  rawData?: {
    searchVolume?: number;
    competitionLevel?: string;
    relatedQueries?: string[];
  };
}

/**
 * Get market intent for a set of keywords
 *
 * For MVP/Demo: Returns simulated data
 * For Production: Integrate with:
 *  - Google Trends API (free but limited)
 *  - Semrush API ($$$)
 *  - Ahrefs API ($$$)
 *  - Glimpse ($$)
 */
export async function getDemandSignal(keywords: string[]): Promise<DemandSignal> {
  // TODO: In production, integrate with actual API
  // For now, return demo data showing the concept

  console.log(`[Demand Proxy] Checking intent for keywords: ${keywords.join(', ')}`);

  // Simulate API call
  const simulatedSearchVolume = Math.floor(Math.random() * 10000);
  const simulatedGrowth = (Math.random() - 0.5) * 200; // -100% to +100%

  // Normalize to 0-100 score
  const intentScore = Math.min(100, Math.floor((simulatedSearchVolume / 10000) * 100));

  // Determine trend
  let trend: 'rising' | 'falling' | 'flat';
  if (simulatedGrowth > 20) {
    trend = 'rising';
  } else if (simulatedGrowth < -20) {
    trend = 'falling';
  } else {
    trend = 'flat';
  }

  return {
    keywords,
    intentScore,
    trend,
    velocity: Math.round(simulatedGrowth),
    source: 'google_trends', // In production, this would be the actual source
    lastUpdated: new Date(),
    rawData: {
      searchVolume: simulatedSearchVolume,
      competitionLevel: intentScore > 70 ? 'high' : intentScore > 40 ? 'medium' : 'low',
      relatedQueries: [
        `best ${keywords[0]} alternative`,
        `${keywords[0]} vs competitors`,
        `how to ${keywords[0]}`,
      ],
    },
  };
}

/**
 * Integration with Google Trends (Production-ready example)
 *
 * Requires: npm install google-trends-api
 *
 * Example implementation:
 *
 * ```typescript
 * import googleTrends from 'google-trends-api';
 *
 * export async function getDemandSignalFromGoogleTrends(keywords: string[]): Promise<DemandSignal> {
 *   const results = await googleTrends.interestOverTime({
 *     keyword: keywords,
 *     startTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
 *   });
 *
 *   // Parse results and calculate scores
 *   // ...
 * }
 * ```
 */

/**
 * Integration with Semrush (Production-ready example)
 *
 * Requires: SEMRUSH_API_KEY environment variable
 *
 * Example implementation:
 *
 * ```typescript
 * export async function getDemandSignalFromSemrush(keywords: string[]): Promise<DemandSignal> {
 *   const apiKey = process.env.SEMRUSH_API_KEY;
 *   const keyword = keywords[0]; // Semrush charges per keyword
 *
 *   const response = await fetch(
 *     `https://api.semrush.com/?type=phrase_this&key=${apiKey}&phrase=${encodeURIComponent(keyword)}&export_columns=Ph,Nq,Cp`
 *   );
 *
 *   // Parse CSV response
 *   // Ph = Keyword, Nq = Search Volume, Cp = Competition
 *   // ...
 * }
 * ```
 */

/**
 * Format demand signal for UI display
 */
export function formatDemandSignal(signal: DemandSignal): string {
  const trendIcon = signal.trend === 'rising' ? '📈' : signal.trend === 'falling' ? '📉' : '➡️';

  return `
**Market Intent: ${signal.intentScore}/100** ${trendIcon}

Search Volume: ${signal.rawData?.searchVolume?.toLocaleString() || 'N/A'}
Trend: ${signal.trend.toUpperCase()} (${signal.velocity > 0 ? '+' : ''}${signal.velocity}% MoM)
Competition: ${signal.rawData?.competitionLevel || 'unknown'}

Source: ${signal.source}
Last Updated: ${signal.lastUpdated.toLocaleDateString()}
  `.trim();
}

/**
 * Determine if demand is "rising" enough to trigger an alert
 */
export function isRisingDemand(signal: DemandSignal, threshold: number = 50): boolean {
  return signal.trend === 'rising' && signal.velocity > threshold;
}

/**
 * Calculate "Opportunity Score" based on Intent + Saturation
 *
 * High Intent + Low Saturation = High Opportunity
 * Low Intent + High Saturation = Low Opportunity
 */
export function calculateOpportunityScore(
  intentScore: number,
  saturationScore: number
): { score: number; status: 'wide_open' | 'emerging' | 'closing' | 'saturated' } {
  // Formula: (Intent + (100 - Saturation)) / 2
  // This gives us a score where:
  // - High demand + low competition = ~100
  // - Low demand + high competition = ~0

  const score = Math.round((intentScore + (100 - saturationScore)) / 2);

  let status: 'wide_open' | 'emerging' | 'closing' | 'saturated';

  if (score >= 75) {
    status = 'wide_open'; // High demand, low competition
  } else if (score >= 50) {
    status = 'emerging'; // Growing demand, some competition
  } else if (score >= 25) {
    status = 'closing'; // Demand exists but highly competitive
  } else {
    status = 'saturated'; // Low demand or overcrowded market
  }

  return { score, status };
}
