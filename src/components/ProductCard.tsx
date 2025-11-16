import Image from 'next/image';
import { ExternalLink, TrendingUp, MessageCircle } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  url: string | null;
  imageUrl: string | null;
  producerName: string | null;
  producerUrl: string | null;
  launchDate: Date | null;
  upvotes: number | null;
  comments: number | null;
  useCases: unknown;
  downsides: unknown;
  categories: unknown;
  tags: unknown;
  qualityScore: number | null;
  recencyScore: number | null;
}

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const useCases = (product.useCases as string[]) || [];
  const downsides = (product.downsides as string[]) || [];
  const categories = (product.categories as string[]) || [];

  return (
    <article className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
      {/* Image */}
      {product.imageUrl && (
        <div className="mb-4 rounded-lg overflow-hidden bg-gray-100">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-48 object-cover"
          />
        </div>
      )}

      {/* Header */}
      <div className="mb-3">
        <h3 className="text-xl font-semibold text-gray-900 mb-1">
          {product.url ? (
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 transition inline-flex items-center gap-2"
            >
              {product.name}
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            product.name
          )}
        </h3>

        {product.tagline && (
          <p className="text-gray-600 text-sm">{product.tagline}</p>
        )}
      </div>

      {/* Producer */}
      {product.producerName && (
        <p className="text-xs text-gray-500 mb-3">
          by{' '}
          {product.producerUrl ? (
            <a
              href={product.producerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 transition"
            >
              {product.producerName}
            </a>
          ) : (
            product.producerName
          )}
        </p>
      )}

      {/* Use Cases */}
      {useCases.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">
            Use Cases
          </h4>
          <ul className="space-y-1">
            {useCases.map((useCase, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{useCase}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Downsides */}
      {downsides.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">
            Downsides
          </h4>
          <ul className="space-y-1">
            {downsides.map((downside, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">⚠</span>
                <span>{downside}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.slice(0, 4).map((category, i) => (
            <span
              key={i}
              className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
            >
              {category}
            </span>
          ))}
        </div>
      )}

      {/* Footer Stats */}
      <div className="flex items-center gap-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
        {product.upvotes !== null && product.upvotes > 0 && (
          <div className="flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            <span>{product.upvotes}</span>
          </div>
        )}
        {product.comments !== null && product.comments > 0 && (
          <div className="flex items-center gap-1">
            <MessageCircle className="w-4 h-4" />
            <span>{product.comments}</span>
          </div>
        )}
        {product.launchDate && (
          <div className="ml-auto text-xs">
            {new Date(product.launchDate).toLocaleDateString()}
          </div>
        )}
      </div>
    </article>
  );
}
