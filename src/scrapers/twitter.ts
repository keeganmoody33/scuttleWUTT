import axios from 'axios';
import { db, products, productSources, scrapingJobs } from '@/db';
import { generateId } from '@/lib/utils';
import { eq } from 'drizzle-orm';

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

  console.log('Starting Twitter scrape...');

  try {
    await db.insert(scrapingJobs).values({
      id: jobId,
      sourceType: 'twitter',
      status: 'running',
      startedAt: new Date(),
      createdAt: new Date(),
    });

    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    if (!bearerToken) {
      throw new Error('TWITTER_BEARER_TOKEN not configured');
    }

    for (const query of LAUNCH_QUERIES) {
      try {
        const response = await axios.get<TwitterResponse>(TWITTER_API_URL, {
          params: {
            query: query,
            max_results: 20,
            'tweet.fields': 'created_at,public_metrics,entities',
            'user.fields': 'name,username',
            expansions: 'author_id',
          },
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        });

        if (!response.data.data || response.data.data.length === 0) {
          continue;
        }

        const tweets = response.data.data;
        const users = response.data.includes?.users || [];

        for (const tweet of tweets) {
          try {
            // Check if we already scraped this tweet
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

            // Find author
            const author = users.find((u) => u.id === tweet.author_id);
            if (!author) continue;

            // Extract URL from tweet
            const url = tweet.entities?.urls?.[0]?.expanded_url || '';
            if (!url || url.includes('twitter.com')) {
              continue; // Skip if no external URL
            }

            // Extract hashtags as categories
            const categories = tweet.entities?.hashtags?.map((h) => h.tag) || [];

            // Calculate engagement score
            const engagement =
              tweet.public_metrics.like_count +
              tweet.public_metrics.retweet_count * 2 +
              tweet.public_metrics.reply_count;

            // Only consider tweets with some engagement
            if (engagement < 5) {
              continue;
            }

            // Create product
            const productId = generateId('prod');
            await db.insert(products).values({
              id: productId,
              name: this.extractProductName(tweet.text),
              tagline: this.cleanTweetText(tweet.text),
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

            // Create source
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
            console.log(`✓ Scraped tweet: ${tweet.text.substring(0, 50)}...`);
          } catch (err) {
            const error = `Error processing tweet ${tweet.id}: ${err}`;
            console.error(error);
            errors.push(error);
          }
        }
      } catch (err) {
        console.error(`Error with query "${query}":`, err);
        errors.push(`Query "${query}" failed: ${err}`);
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

    console.log(`✓ Twitter scrape completed: ${productsFound} products found`);
  } catch (err) {
    console.error('Twitter scrape failed:', err);

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
