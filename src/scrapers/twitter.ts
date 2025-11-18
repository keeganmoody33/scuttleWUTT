import axios from 'axios';
import { db, products, productSources, scrapingJobs } from '@/db';
import { generateId } from '@/lib/utils';
import { eq } from 'drizzle-orm';
import { env } from '@/lib/env';
import { logger } from '@/services/logger';

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
  author_id: string;
  entities?: {
    urls?: Array<{
      expanded_url: string;
      display_url: string;
    }>;
    hashtags?: Array<{
      tag: string;
    }>;
  };
}

interface TwitterUser {
  id: string;
  name: string;
  username: string;
}

interface TwitterResponse {
  data: Tweet[];
  includes?: {
    users: TwitterUser[];
  };
  meta: {
    result_count: number;
  };
}

const TWITTER_API_URL = 'https://api.twitter.com/2/tweets/search/recent';

// Search queries for product launches
const LAUNCH_QUERIES = [
  'launching today -is:retweet',
  'just launched -is:retweet',
  'we built -is:retweet',
  'introducing our new -is:retweet',
  'shipping today -is:retweet',
];

export async function scrapeTwitter() {
  const jobId = generateId('job');
  let productsFound = 0;
  const errors: string[] = [];

  logger.info('Starting Twitter scrape');

  try {
    await db.insert(scrapingJobs).values({
      id: jobId,
      sourceType: 'twitter',
      status: 'running',
      startedAt: new Date(),
      createdAt: new Date(),
    });

    if (!env.TWITTER_BEARER_TOKEN) {
      throw new Error('TWITTER_BEARER_TOKEN not configured');
    }

    for (const query of LAUNCH_QUERIES) {
      try {
        const response = await axios.get<TwitterResponse>(TWITTER_API_URL, {
          params: {
            query,
            max_results: 20,
            'tweet.fields': 'created_at,public_metrics,entities',
            'user.fields': 'name,username',
            expansions: 'author_id',
          },
          headers: {
            Authorization: `Bearer ${env.TWITTER_BEARER_TOKEN}`,
          },
        });

        if (!response.data.data || response.data.data.length === 0) {
          continue;
        }

        const tweets = response.data.data;
        const users = response.data.includes?.users || [];

        for (const tweet of tweets) {
          try {
            const existingSource = await db.query.productSources.findFirst({
              where: (sources, { and, eq }) =>
                and(
                  eq(sources.sourceType, 'twitter'),
                  eq(sources.sourceId, tweet.id)
                ),
            });

            if (existingSource) {
              continue;
            }

            const author = users.find((u) => u.id === tweet.author_id);
            if (!author) continue;

            const url = tweet.entities?.urls?.[0]?.expanded_url || '';
            if (!url || url.includes('twitter.com')) {
              continue;
            }

            const categories = tweet.entities?.hashtags?.map((h) => h.tag) || [];

            const engagement =
              tweet.public_metrics.like_count +
              tweet.public_metrics.retweet_count * 2 +
              tweet.public_metrics.reply_count;

            if (engagement < 5) {
              continue;
            }

            const productId = generateId('prod');
            await db.insert(products).values({
              id: productId,
              name: extractProductName(tweet.text),
              tagline: cleanTweetText(tweet.text),
              description: tweet.text,
              url,
              producerName: author.name,
              producerUrl: `https://twitter.com/${author.username}`,
              launchDate: new Date(tweet.created_at),
              mentions: engagement,
              categories,
              tags: categories,
              processed: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            await db.insert(productSources).values({
              id: generateId('src'),
              productId,
              sourceType: 'twitter',
              sourceId: tweet.id,
              sourceUrl: `https://twitter.com/${author.username}/status/${tweet.id}`,
              sourceData: { tweet, author },
              scrapedAt: new Date(),
            });

            productsFound++;
            logger.info('Scraped Twitter launch', { tweetId: tweet.id });
          } catch (err) {
            const error = `Error processing tweet ${tweet.id}: ${err}`;
            logger.warn('Twitter scraper failed to process tweet', { error });
            errors.push(error);
          }
        }
      } catch (err) {
        const errorMsg = `Error with query "${query}"`;
        logger.warn(errorMsg, { error: err });
        errors.push(`${errorMsg}: ${err}`);
      }
    }

    await db
      .update(scrapingJobs)
      .set({
        status: 'completed',
        productsFound,
        completedAt: new Date(),
        errors: errors.length > 0 ? errors : undefined,
      })
      .where(eq(scrapingJobs.id, jobId));

    logger.info('Twitter scrape completed', { productsFound });
  } catch (err) {
    logger.error('Twitter scrape failed', err);

    await db
      .update(scrapingJobs)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errors: [String(err)],
      })
      .where(eq(scrapingJobs.id, jobId));

    throw err;
  }
}

function extractProductName(text: string): string {
  // Try to extract product name from common patterns
  const patterns = [
    /(?:Introducing|Launching|Built)\s+([A-Z][a-zA-Z0-9\s]{2,30})/,
    /^([A-Z][a-zA-Z0-9\s]{2,30})\s+(?:is|just|now)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  // Fallback: use first few words
  return text.split(' ').slice(0, 3).join(' ');
}

function cleanTweetText(text: string): string {
  // Remove URLs
  let cleaned = text.replace(/https?:\/\/[^\s]+/g, '');
  // Remove excessive whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned.substring(0, 200);
}

// Run if executed directly
if (require.main === module) {
  scrapeTwitter()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
