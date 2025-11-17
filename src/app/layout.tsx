import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import './win98.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Scuttle What - Your Curated Feed of Promising New Products',
  description: 'Stay updated with the most promising tools and products brought to market, tailored to your interests.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
