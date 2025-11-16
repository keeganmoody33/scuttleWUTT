'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, Mail, CheckCircle } from 'lucide-react';
import Link from 'next/link';

// Add metadata via client-side head update
if (typeof document !== 'undefined') {
  document.title = 'Scuttle What - Get Unbiased SaaS Recommendations from AI Consensus';

  // Update meta description
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute(
    'content',
    'Which SaaS tool should you actually use? We cross-reference Claude, GPT-4, and DeepSeek to show you consensus recommendations. No BS, just AI-verified answers.'
  );
}

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
  trustBadge?: {
    modelsUsed: number;
    modelsQueried: number;
    consensusScore: number;
    diversityScore: number;
    message: string;
    breakdown: {
      unanimous: number;
      majority: number;
      unique: number;
    };
  };
  signals?: {
    marketIntent: {
      score: number;
      trend: string;
      source: string;
    };
    marketSaturation: {
      score: number;
      competitorsFound: number;
    };
  };
  methodologyUrl?: string;
}

export default function AskPage() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Subscription state
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'email' | 'sms' | 'both'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [frequencyDays, setFrequencyDays] = useState(7); // Default to weekly
  const [notifyOnChangeOnly, setNotifyOnChangeOnly] = useState(true); // Default to change-only
  const [subscribing, setSubscribing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  // Verification state
  const [showVerification, setShowVerification] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim()) return;

    setLoading(true);
    setLoadingProgress(0);
    setError(null);
    setAnswer(null);
    setShowSubscribe(false);
    setSubscribed(false);

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 90) return prev; // Cap at 90% until real response
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      const response = await fetch('/api/consensus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get answer');
      }

      const data = await response.json();
      setLoadingProgress(100);
      setAnswer(data);
      setShowSubscribe(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        setLoading(false);
        setLoadingProgress(0);
      }, 300);
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
          notifyOnChangeOnly,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to subscribe');
      }

      const data = await response.json();

      // Show verification step
      setSubscriptionId(data.subscriptionId);
      setShowVerification(true);
      setShowSubscribe(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to subscribe');
    } finally {
      setSubscribing(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subscriptionId || !verificationCode.trim()) return;

    setVerifying(true);
    setVerificationError(null);

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId,
          code: verificationCode.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify');
      }

      // Success!
      setSubscribed(true);
      setShowVerification(false);
      setVerificationCode('');
      setEmail('');
      setPhone('');
    } catch (err) {
      setVerificationError(err instanceof Error ? err.message : 'Failed to verify');
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (!subscriptionId) return;

    try {
      const response = await fetch('/api/verify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to resend code');
      }

      alert('Verification code resent!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resend code');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <nav className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold text-gray-900">
              Scuttle What
            </Link>
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full">
              <div className="w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse"></div>
              <span className="text-xs font-semibold text-green-800">
                1,247 questions answered
              </span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/compare"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span className="hidden sm:inline">Compare Models</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                30+ AI
              </span>
            </Link>
            <Link
              href="/alpha"
              className="text-sm font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1"
            >
              <span className="hidden sm:inline">Scuttle Alpha</span>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                PRO
              </span>
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full mb-6">
            <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
            <span className="text-sm font-semibold text-green-800">Cross-verified by 3 leading AI models</span>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Which SaaS tool should you actually use?
          </h1>
          <p className="text-xl text-gray-600 mb-4">
            We ask 3 leading AI models, then show you only what they agree on.
          </p>
          <p className="text-base text-gray-500 max-w-2xl mx-auto">
            No single AI has all the answers. We cross-reference Claude Sonnet 4.5, GPT-4o, and DeepSeek—then show you the <span className="font-semibold text-gray-700">consensus</span>. See exactly where each recommendation came from.
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

        {/* Loading Progress */}
        {loading && (
          <div className="mb-12 bg-white border-2 border-blue-200 rounded-xl p-6 shadow-lg">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">
                  Cross-referencing AI models...
                </span>
                <span className="text-sm font-bold text-blue-600">
                  {Math.round(loadingProgress)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {['Claude Sonnet 4.5', 'GPT-4o', 'DeepSeek'].map((model, idx) => (
                <div
                  key={model}
                  className={`px-3 py-2 rounded text-sm text-center font-medium transition-all ${
                    loadingProgress > (idx + 1) * 30
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-gray-100 text-gray-500 border border-gray-300'
                  }`}
                >
                  {loadingProgress > (idx + 1) * 30 ? '✓ ' : '⏳ '}
                  {model}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Querying each model in parallel for consensus analysis...
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-8 bg-red-50 border-2 border-red-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                !
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-2">Couldn't get consensus</h3>
                <p className="text-sm text-red-700 mb-4">{error}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setError(null);
                      handleAsk(new Event('submit') as any);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => setError(null)}
                    className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-100 transition text-sm font-semibold"
                  >
                    Dismiss
                  </button>
                </div>
                <p className="text-xs text-red-600 mt-3">
                  Tip: Models occasionally timeout. Retrying usually works!
                </p>
              </div>
            </div>
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

            {/* Trust Badge - Transparency Signals */}
            {answer.trustBadge && (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                    ✓
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      Cross-Verified Answer
                    </h3>
                    <p className="text-sm text-gray-600">
                      {answer.trustBadge.message}
                    </p>
                  </div>
                </div>

                {/* Consensus Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-white/70 rounded-lg p-3 border border-green-200">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Consensus</div>
                    <div className="text-2xl font-bold text-green-700">
                      {answer.trustBadge.consensusScore}%
                    </div>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3 border border-blue-200">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Models Used</div>
                    <div className="text-2xl font-bold text-blue-700">
                      {answer.trustBadge.modelsUsed}/{answer.trustBadge.modelsQueried}
                    </div>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3 border border-purple-200">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Diversity</div>
                    <div className="text-2xl font-bold text-purple-700">
                      {answer.trustBadge.diversityScore}%
                    </div>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3 border border-orange-200">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Agreement</div>
                    <div className="text-sm font-bold text-orange-700 mt-1">
                      {answer.trustBadge.breakdown.unanimous} unanimous<br/>
                      {answer.trustBadge.breakdown.majority} majority
                    </div>
                  </div>
                </div>

                {/* Market Signals */}
                {answer.signals && (
                  <div className="bg-white/70 rounded-lg p-4 mb-4 border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Market Signals</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-600">Market Intent</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            answer.signals.marketIntent.trend === 'rising'
                              ? 'bg-green-100 text-green-700'
                              : answer.signals.marketIntent.trend === 'falling'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {answer.signals.marketIntent.trend}
                          </span>
                        </div>
                        <div className="text-lg font-bold text-gray-900">
                          {answer.signals.marketIntent.score}/100
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Source: {answer.signals.marketIntent.source.replace('_', ' ')}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-600 mb-1">Market Saturation</div>
                        <div className="text-lg font-bold text-gray-900">
                          {answer.signals.marketSaturation.score}%
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {answer.signals.marketSaturation.competitorsFound} tools analyzed
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Methodology Link */}
                {answer.methodologyUrl && (
                  <div className="text-center">
                    <Link
                      href={answer.methodologyUrl}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-sm font-medium text-gray-700 hover:text-blue-700"
                    >
                      View Full Methodology & Model Comparison →
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Upgrade CTA - Scuttle Alpha */}
            {answer && answer.signals && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 text-4xl">📈</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">Track this opportunity over time</h3>
                      <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full font-bold">
                        PRO
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-4">
                      This market shows <span className="font-semibold text-purple-700">{answer.signals.marketIntent.score}/100 demand</span> with{' '}
                      <span className="font-semibold text-purple-700">{answer.signals.marketSaturation.score}% saturation</span>.
                      Want to know when the opportunity window opens or closes?
                    </p>
                    <div className="flex gap-3">
                      <Link
                        href="/alpha"
                        className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition font-semibold text-sm shadow-md"
                      >
                        Track with Scuttle Alpha →
                      </Link>
                      <Link
                        href="/alpha"
                        className="px-4 py-2.5 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition text-sm font-medium"
                      >
                        Learn More
                      </Link>
                    </div>
                    <p className="text-xs text-gray-600 mt-3">
                      ✨ Automatically tracks demand + saturation daily and alerts you when windows shift
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Timeline Link */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-900 text-sm">
                  Track how this answer evolves over time
                </h4>
                <p className="text-xs text-gray-600 mt-1">
                  See what tools come and go, and how rankings change
                </p>
              </div>
              <Link
                href={`/question/${answer.questionId}/timeline`}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition font-medium text-sm whitespace-nowrap"
              >
                View Timeline →
              </Link>
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      When do you want to be notified?
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => setNotifyOnChangeOnly(true)}
                        className={`px-4 py-3 rounded-lg border-2 transition text-left ${
                          notifyOnChangeOnly
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 text-gray-700 hover:border-blue-300'
                        }`}
                      >
                        <div className="font-semibold">Only when the answer changes</div>
                        <div className="text-xs mt-1 opacity-80">
                          We'll skip updates if nothing has changed (recommended)
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotifyOnChangeOnly(false)}
                        className={`px-4 py-3 rounded-lg border-2 transition text-left ${
                          !notifyOnChangeOnly
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 text-gray-700 hover:border-blue-300'
                        }`}
                      >
                        <div className="font-semibold">Every time (even if no changes)</div>
                        <div className="text-xs mt-1 opacity-80">
                          Get updates on your schedule regardless of changes
                        </div>
                      </button>
                    </div>
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

            {/* Verification Step */}
            {showVerification && !subscribed && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-600" />
                  Verify your {deliveryMethod === 'email' ? 'email' : deliveryMethod === 'sms' ? 'phone' : 'contact'}
                </h3>
                <p className="text-gray-600 mb-4 text-sm">
                  We sent a 6-digit code to {deliveryMethod === 'email' ? email : deliveryMethod === 'sms' ? phone : `${email} and ${phone}`}.
                  Enter it below to activate your subscription.
                </p>

                {verificationError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {verificationError}
                  </div>
                )}

                <form onSubmit={handleVerify} className="space-y-3">
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest font-mono"
                    required
                  />

                  <button
                    type="submit"
                    disabled={verifying || verificationCode.length !== 6}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-semibold"
                  >
                    {verifying ? 'Verifying...' : 'Verify & Activate'}
                  </button>

                  <button
                    type="button"
                    onClick={handleResendCode}
                    className="w-full px-6 py-2 text-blue-600 hover:text-blue-700 text-sm transition"
                  >
                    Didn't receive the code? Resend
                  </button>
                </form>

                <p className="mt-4 text-xs text-gray-500 text-center">
                  Code expires in 10 minutes
                </p>
              </div>
            )}

            {/* Subscribed Confirmation */}
            {subscribed && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  You're verified & subscribed!
                </h3>
                <p className="text-gray-600 text-sm">
                  We'll send you updates for "{answer?.question}" every{' '}
                  {frequencyDays === 1
                    ? 'day'
                    : frequencyDays === 7
                    ? 'week'
                    : `${frequencyDays} days`}
                  {deliveryMethod === 'email' && ' via email'}
                  {deliveryMethod === 'sms' && ' via SMS'}
                  {deliveryMethod === 'both' && ' via email and SMS'}
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
              Popular questions where consensus matters:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                'Best CRM for small sales teams',
                'Most accurate AI meeting notes tool',
                'Best analytics tool for SaaS startups',
                'Salesforce vs HubSpot for SMB',
                'Best cold email outreach platform',
                'Most reliable email verification API',
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => setQuestion(example)}
                  className="px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left text-sm text-gray-700 hover:shadow-sm"
                >
                  <span className="font-medium">{example}</span>
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-gray-500 mt-6">
              💡 Tip: Ask "vs" questions or request "best" tools for your specific use case
            </p>
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
