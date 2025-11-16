import Link from 'next/link';

export function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-gray-900">
          Scuttle What
        </Link>

        <div className="flex items-center gap-6">
          <Link
            href="/browse"
            className="text-gray-600 hover:text-gray-900 transition"
          >
            Browse
          </Link>
          <Link
            href="/settings"
            className="text-gray-600 hover:text-gray-900 transition"
          >
            Settings
          </Link>
          <Link
            href="/settings"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  );
}
