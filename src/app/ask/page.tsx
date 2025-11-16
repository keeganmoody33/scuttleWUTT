'use client';

import { useState } from 'react';
import { Search, Loader2, Mail, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface Tool {
  name: string;
  description: string;
  maker: string;
  useCase: string;
  proof: string;
  downside: string;
  link: string;
}

interface Answer {
  questionId: string;
  question: string;
  answer: {
    tools: Tool[];
    generatedAt: string;
  };
}

export default function AskPage() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Subscription state
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'email' | 'sms' | 'both'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [frequencyDays, setFrequencyDays] = useState(7); // Default to weekly
  const [subscribing, setSubscribing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    setAnswer(null);
    setShowSubscribe(false);
    setSubscribed(false);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get answer');
      }

      const data = await response.json();
      setAnswer(data);
      setShowSubscribe(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!answer) return;

    // Validation based on delivery method
    if ((deliveryMethod === 'email' || deliveryMethod === 'both') && !email.trim()) {
      alert('Email is required for email delivery');
      return;
    }
    if ((deliveryMethod === 'sms' || deliveryMethod === 'both') && !phone.trim()) {
      alert('Phone number is required for SMS delivery');
      return;
    }

    setSubscribing(true);

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          deliveryMethod,
          questionId: answer.questionId,
          question: answer.question,
          frequencyDays,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to subscribe');
      }

      setSubscribed(true);
      setEmail('');
      setPhone('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to subscribe');
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <nav className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900">
            Scuttle What
          </Link>
          <div className="text-sm text-gray-600">
            Ask. Get answers. Subscribe to updates.
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            What are you looking for?
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Ask about any SaaS tool category. Get vetted, recent tools with real social proof.
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleAsk} className="mb-12">
          <div className="relative">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., Best sales engagement tool, AI meeting notes, Customer feedback platform..."
              className="w-full px-6 py-4 pr-14 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Search className="w-6 h-6" />
              )}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Answer */}
        {answer && (
          <div className="space-y-6">
            {/* Tools */}
            <div className="space-y-4">
              {answer.answer.tools.map((tool, index) => (
                <div
                  key={index}
                  className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        <a
                          href={tool.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-600 transition"
                        >
                          {tool.name}
                        </a>
                      </h3>
                      <p className="text-gray-600 mb-4">{tool.description}</p>

                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-semibold text-gray-700">Maker:</span>{' '}
                          <span className="text-gray-600">{tool.maker}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Use case:</span>{' '}
                          <span className="text-gray-600">{tool.useCase}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-green-700">Proof:</span>{' '}
                          <span className="text-green-600">{tool.proof}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-amber-700">Downside:</span>{' '}
                          <span className="text-amber-600">{tool.downside}</span>
                        </div>
                      </div>

                      <div className="mt-4">
                        <a
                          href={tool.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                        >
                          → Visit website
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Subscribe Section */}
            {showSubscribe && !subscribed && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-600" />
                  Want updates when this answer changes?
                </h3>
                <p className="text-gray-600 mb-4 text-sm">
                  The SaaS market moves fast. Subscribe and we'll re-check this question on your
                  schedule and email you when things change.
                </p>

                <form onSubmit={handleSubscribe} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      How do you want to receive updates?
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setDeliveryMethod('email')}
                        className={`px-4 py-2 rounded-lg border-2 transition ${
                          deliveryMethod === 'email'
                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                            : 'border-gray-300 text-gray-700 hover:border-blue-300'
                        }`}
                      >
                        Email
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryMethod('sms')}
                        className={`px-4 py-2 rounded-lg border-2 transition ${
                          deliveryMethod === 'sms'
                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                            : 'border-gray-300 text-gray-700 hover:border-blue-300'
                        }`}
                      >
                        SMS
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryMethod('both')}
                        className={`px-4 py-2 rounded-lg border-2 transition ${
                          deliveryMethod === 'both'
                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                            : 'border-gray-300 text-gray-700 hover:border-blue-300'
                        }`}
                      >
                        Both
                      </button>
                    </div>
                  </div>

                  {(deliveryMethod === 'email' || deliveryMethod === 'both') && (
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required={deliveryMethod === 'email' || deliveryMethod === 'both'}
                    />
                  )}

                  {(deliveryMethod === 'sms' || deliveryMethod === 'both') && (
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required={deliveryMethod === 'sms' || deliveryMethod === 'both'}
                    />
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      How often do you want updates?
                    </label>
                    <select
                      value={frequencyDays}
                      onChange={(e) => setFrequencyDays(Number(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={1}>Daily</option>
                      <option value={3}>Every 3 days</option>
                      <option value={7}>Weekly</option>
                      <option value={14}>Every 2 weeks</option>
                      <option value={30}>Monthly</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={subscribing || !email.trim()}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-semibold"
                  >
                    {subscribing ? 'Subscribing...' : 'Subscribe to Updates'}
                  </button>
                </form>
              </div>
            )}

            {/* Subscribed Confirmation */}
            {subscribed && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  You're subscribed!
                </h3>
                <p className="text-gray-600 text-sm">
                  We'll email you updates for "{answer.question}" every{' '}
                  {frequencyDays === 1
                    ? 'day'
                    : frequencyDays === 7
                    ? 'week'
                    : `${frequencyDays} days`}
                  .
                </p>
              </div>
            )}
          </div>
        )}

        {/* Example Questions */}
        {!answer && !loading && (
          <div className="mt-16">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 text-center">
              Try asking:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                'Best sales engagement tool',
                'AI meeting notes app',
                'Customer feedback platform for SaaS',
                'LinkedIn automation tool',
                'Email verification service',
                'Product analytics tool',
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => setQuestion(example)}
                  className="px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left text-sm text-gray-700"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-24 py-8 border-t border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>Scuttle What - Cut through the noise, find what matters.</p>
        </div>
      </footer>
    </div>
  );
}
