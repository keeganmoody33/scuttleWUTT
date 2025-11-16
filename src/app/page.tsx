import { db } from '@/db';
import { ProductCard } from '@/components/ProductCard';
import { Header } from '@/components/Header';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // Get top products (processed, sorted by quality score)
  const topProducts = await db.query.products.findMany({
    where: (products, { eq }) => eq(products.processed, true),
    orderBy: (products, { desc }) => [
      desc(products.qualityScore),
      desc(products.recencyScore),
    ],
    limit: 30,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Scuttle What
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Your curated feed of the most promising products brought to market
          </p>
          <p className="text-gray-500">
            We scrape Product Hunt, Twitter, and more to find the best new tools. <br />
            Get personalized digests delivered to your inbox.
          </p>
        </div>

        {topProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              No products yet. Run the scrapers to get started!
            </p>
            <code className="block mt-4 p-4 bg-gray-100 rounded text-sm">
              npm run scrape
            </code>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {topProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>

      <footer className="mt-24 py-8 border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>Built to cut through the noise and surface what matters.</p>
        </div>
      </footer>
    </div>
  );
}
