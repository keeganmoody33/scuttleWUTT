import { scrapeProductHunt } from './producthunt';
import { scrapeTwitter } from './twitter';
import { analyzeProducts } from '@/services/llm-analysis';
import { scoreProducts } from '@/services/scoring';

export async function runAllScrapers() {
  console.log('🚀 Starting all scrapers...\n');

  try {
    // Run scrapers in parallel
    await Promise.all([
      scrapeProductHunt().catch((err) => {
        console.error('Product Hunt scraper failed:', err);
      }),
      scrapeTwitter().catch((err) => {
        console.error('Twitter scraper failed:', err);
      }),
    ]);

    console.log('\n✓ All scrapers completed');

    // Analyze unprocessed products with LLM
    console.log('\n🤖 Analyzing products with LLM...');
    await analyzeProducts();

    // Score all products
    console.log('\n📊 Scoring products...');
    await scoreProducts();

    console.log('\n✅ All done!');
  } catch (err) {
    console.error('Error running scrapers:', err);
    throw err;
  }
}

// Run if executed directly
if (require.main === module) {
  runAllScrapers()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
