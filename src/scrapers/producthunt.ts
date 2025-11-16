import axios from 'axios';
import { db, products, productSources, scrapingJobs } from '@/db';
import { generateId } from '@/lib/utils';
import { eq } from 'drizzle-orm';

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

  console.log('Starting Product Hunt scrape...');

  try {
    // Create scraping job
    await db.insert(scrapingJobs).values({
      id: jobId,
      sourceType: 'producthunt',
      status: 'running',
      startedAt: new Date(),
      createdAt: new Date(),
    });

    const apiKey = process.env.PRODUCTHUNT_API_KEY;
    if (!apiKey) {
      throw new Error('PRODUCTHUNT_API_KEY not configured');
    }

    // Fetch today's featured products
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
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const posts = response.data.data.posts.edges;

    for (const { node: post } of posts) {
      try {
        // Check if we already have this product source
        const existingSource = await db.query.productSources.findFirst({
          where: (sources, { and, eq }) =>
            and(
              eq(sources.sourceType, 'producthunt'),
              eq(sources.sourceId, post.id)
            ),
        });

        if (existingSource) {
          console.log(`Product already exists: ${post.name}`);
          continue;
        }

        // Extract categories from topics
        const categories = post.topics.edges.map((edge) => edge.node.name);

        // Create product
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
          tags: categories, // Will be enriched later
          processed: false, // LLM analysis pending
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Create product source
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
        console.log(`✓ Scraped: ${post.name} (${post.votesCount} upvotes)`);
      } catch (err) {
        const error = `Error processing product ${post.name}: ${err}`;
        console.error(error);
        errors.push(error);
      }
    }

    // Update job as completed
    await db
      .update(scrapingJobs)
      .set({
        status: 'completed',
        productsFound,
        completedAt: new Date(),
        errors: errors.length > 0 ? errors : undefined,
      })
      .where(eq(scrapingJobs.id, jobId));

    console.log(`✓ Product Hunt scrape completed: ${productsFound} products found`);
  } catch (err) {
    console.error('Product Hunt scrape failed:', err);

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
