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
            Cut through the noise. Find SaaS tools that actually matter.
          </p>
          <p className="text-gray-500 mb-8">
            Ask about any tool category. Get vetted recommendations with real social proof. <br />
            Subscribe to answers and track how they change over time.
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="/ask"
              className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-lg"
            >
              Ask a Question
            </a>
            <a
              href="#browse"
              className="px-8 py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:border-blue-500 hover:text-blue-600 transition font-semibold text-lg"
            >
              Browse Tools
            </a>
          </div>
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
