import OpenAI from 'openai';
import { db, products } from '@/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ProductAnalysisSchema = z.object({
  useCases: z.array(z.string()).describe('3-5 specific use cases or problems this product solves'),
  downsides: z.array(z.string()).describe('2-4 honest limitations, drawbacks, or areas for improvement'),
  categories: z.array(z.string()).describe('2-3 relevant product categories'),
  tags: z.array(z.string()).describe('5-10 relevant tags or keywords'),
});

type ProductAnalysis = z.infer<typeof ProductAnalysisSchema>;

export async function analyzeProduct(product: {
  name: string;
  tagline?: string | null;
  description?: string | null;
  upvotes?: number | null;
  comments?: number | null;
}): Promise<ProductAnalysis> {
  const prompt = `Analyze this product launch and extract structured information:

Product: ${product.name}
Tagline: ${product.tagline || 'N/A'}
Description: ${product.description || 'N/A'}
Engagement: ${product.upvotes || 0} upvotes, ${product.comments || 0} comments

Please provide:
1. Use Cases: 3-5 specific, actionable use cases or problems this product solves
2. Downsides: 2-4 honest limitations, potential drawbacks, or areas that need improvement (be critical and realistic)
3. Categories: 2-3 broad product categories (e.g., "Productivity", "AI Tools", "Developer Tools")
4. Tags: 5-10 specific keywords or tags

Return JSON matching this schema:
{
  "useCases": string[],
  "downsides": string[],
  "categories": string[],
  "tags": string[]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a product analyst who provides honest, concise analysis of new products. Be critical and realistic about downsides.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    return ProductAnalysisSchema.parse(parsed);
  } catch (err) {
    console.error(`Error analyzing product ${product.name}:`, err);
    throw err;
  }
}

export async function analyzeProducts(limit: number = 50) {
  console.log('Analyzing unprocessed products...');

  // Get unprocessed products
  const unprocessedProducts = await db.query.products.findMany({
    where: (products, { eq }) => eq(products.processed, false),
    limit,
  });

  console.log(`Found ${unprocessedProducts.length} unprocessed products`);

  for (const product of unprocessedProducts) {
    try {
      console.log(`Analyzing: ${product.name}...`);

      const analysis = await analyzeProduct(product);

      // Update product with analysis
      await db
        .update(products)
        .set({
          useCases: analysis.useCases,
          downsides: analysis.downsides,
          categories: analysis.categories,
          tags: analysis.tags,
          processed: true,
          updatedAt: new Date(),
        })
        .where(eq(products.id, product.id));

      console.log(`✓ Analyzed: ${product.name}`);
    } catch (err) {
      console.error(`Failed to analyze ${product.name}:`, err);
      // Don't throw, continue with other products
    }
  }

  console.log(`✓ Analysis complete: ${unprocessedProducts.length} products processed`);
}
