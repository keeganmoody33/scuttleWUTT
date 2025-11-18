import axios from 'axios';
import { db, products, productSources, scrapingJobs } from '@/db';
import { generateId } from '@/lib/utils';
import { eq } from 'drizzle-orm';
import { env } from '@/lib/env';

interface ProductHuntPost {
  id: string;
  name: string;
  tagline: string;
  description: string;
  url: string;
  votesCount: number;
  commentsCount: number;
  createdAt: string;
  featuredAt: string | null;
  website: string;
  user: {
    name: string;
    url: string;
  };
  thumbnail: {
    url: string;
  };
  topics: {
    edges: Array<{
      node: {
        name: string;
      };
    }>;
  };
}

interface ProductHuntResponse {
  data: {
    posts: {
      edges: Array<{
        node: ProductHuntPost;
      }>;
    };
  };
}

const PRODUCTHUNT_API_URL = 'https://api.producthunt.com/v2/api/graphql';

const POSTS_QUERY = `
  query Posts($featured: Boolean, $order: PostsOrder) {
    posts(featured: $featured, order: $order, first: 50) {
      edges {
        node {
          id
          name
          tagline
          description
          url
          votesCount
          commentsCount
          createdAt
          featuredAt
          website
          user {
            name
            url
          }
          thumbnail {
            url
          }
          topics {
            edges {
              node {
                name
              }
            }
          }
        }
      }
    }
  }
`;

export async function scrapeProductHunt() {
  const jobId = generateId('job');
  let productsFound = 0;
  const errors: string[] = [];

  logger.info('Starting Product Hunt scrape');

  try {
    await db.insert(scrapingJobs).values({
      id: jobId,
      sourceType: 'producthunt',
      status: 'running',
      startedAt: new Date(),
      createdAt: new Date(),
    });

    if (!env.PRODUCTHUNT_API_KEY) {
      throw new Error('PRODUCTHUNT_API_KEY not configured');
    }

    const response = await axios.post<ProductHuntResponse>(
      PRODUCTHUNT_API_URL,
      {
        query: POSTS_QUERY,
        variables: {
          featured: true,
          order: 'NEWEST',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${env.PRODUCTHUNT_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const posts = response.data.data.posts.edges;

    for (const { node: post } of posts) {
      try {
        const existingSource = await db.query.productSources.findFirst({
          where: (sources, { and, eq }) =>
            and(
              eq(sources.sourceType, 'producthunt'),
              eq(sources.sourceId, post.id)
            ),
        });

        if (existingSource) {
          continue;
        }

        const categories = post.topics.edges.map((edge) => edge.node.name);

        const productId = generateId('prod');
        await db.insert(products).values({
          id: productId,
          name: post.name,
          tagline: post.tagline,
          description: post.description,
          url: post.website || post.url,
          imageUrl: post.thumbnail.url,
          producerName: post.user.name,
          producerUrl: post.user.url,
          launchDate: new Date(post.createdAt),
          upvotes: post.votesCount,
          comments: post.commentsCount,
          categories,
          tags: categories,
          processed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.insert(productSources).values({
          id: generateId('src'),
          productId,
          sourceType: 'producthunt',
          sourceId: post.id,
          sourceUrl: post.url,
          sourceData: post,
          scrapedAt: new Date(),
        });

        productsFound++;
        logger.info('Scraped Product Hunt launch', { productId, name: post.name });
      } catch (err) {
        const error = `Error processing product ${post.name}: ${err}`;
        logger.warn('Product Hunt product processing failed', { error });
        errors.push(error);
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

    logger.info('Product Hunt scrape completed', { productsFound });
  } catch (err) {
    logger.error('Product Hunt scrape failed', err);

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

// Run if executed directly
if (require.main === module) {
  scrapeProductHunt()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
