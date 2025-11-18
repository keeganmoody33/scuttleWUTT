'use client';

import { useState, useEffect } from 'react';
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
  const [currentTime, setCurrentTime] = useState('Loading...');

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

  // Update time every second (client-side only)
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString());
    };
    updateTime(); // Set initial time
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Set document title and meta description on mount
  useEffect(() => {
    document.title = 'ScuttleWUTT - What\'s the scuttlebutt?';

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
  }, []);

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
    <div className="win98-desktop" style={{ minHeight: '100vh' }}>
      {/* Main Window */}
      <div className="win98-window" style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Title Bar */}
        <div className="win98-title-bar">
          <div className="win98-title-bar-text">
            <span>📬</span>
            ScuttleWUTT - What's the scuttlebutt?
          </div>
          <div className="win98-title-bar-controls">
            <button className="win98-title-bar-button" aria-label="Minimize">_</button>
            <button className="win98-title-bar-button" aria-label="Maximize">□</button>
            <button className="win98-title-bar-button" aria-label="Close">×</button>
          </div>
        </div>

        {/* Menu Bar */}
        <div className="win98-menu-bar">
          <Link href="/" className="win98-menu-item">File</Link>
          <span className="win98-menu-item">Edit</span>
          <span className="win98-menu-item">View</span>
          <Link href="/compare" className="win98-menu-item">Compare</Link>
          <Link href="/alpha" className="win98-menu-item">Alpha</Link>
          <span className="win98-menu-item">Help</span>
        </div>

        {/* Window Body */}
        <div className="win98-window-body" style={{ padding: '16px' }}>
          {/* Header Section */}
          <div className="win98-groupbox" style={{ marginBottom: '16px' }}>
            <legend>About this tool</legend>
            <div style={{ padding: '8px' }}>
              <p className="win98-text-lg win98-text-bold" style={{ marginBottom: '8px' }}>
                Which SaaS tool should you actually use?
              </p>
              <p style={{ marginBottom: '4px' }}>
                We ask 3 leading AI models, then show you only what they agree on.
              </p>
              <p style={{ fontSize: '10px', color: '#666' }}>
                Cross-verified by Claude Sonnet 4.5, GPT-4o, and DeepSeek
              </p>
            </div>
          </div>

          {/* Search Form */}
          <div className="win98-groupbox" style={{ marginBottom: '16px' }}>
            <legend>Ask a question</legend>
            <form onSubmit={handleAsk} style={{ padding: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g., Best sales engagement tool..."
                  className="win98-input"
                  style={{ flex: 1, padding: '6px' }}
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !question.trim()}
                  className="win98-button win98-button-default"
                  style={{ width: '80px' }}
                >
                  {loading ? 'Wait...' : 'Ask'}
                </button>
              </div>
            </form>
          </div>

          {/* Loading Progress */}
          {loading && (
            <div className="win98-groupbox" style={{ marginBottom: '16px' }}>
              <legend>Processing...</legend>
              <div style={{ padding: '8px' }}>
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span className="win98-text-sm win98-text-bold">Cross-referencing AI models...</span>
                    <span className="win98-text-sm win98-text-bold">{Math.round(loadingProgress)}%</span>
                  </div>
                  <div className="win98-progress-bar">
                    <div
                      className="win98-progress-fill"
                      style={{ width: `${loadingProgress}%` }}
                    ></div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                  {['Claude Sonnet 4.5', 'GPT-4o', 'DeepSeek'].map((model, idx) => (
                    <div
                      key={model}
                      className="win98-status-field"
                      style={{
                        padding: '4px',
                        textAlign: 'center',
                        fontSize: '10px',
                        background: loadingProgress > (idx + 1) * 30 ? '#008000' : '#c0c0c0',
                        color: loadingProgress > (idx + 1) * 30 ? '#ffffff' : '#000000',
                      }}
                    >
                      {loadingProgress > (idx + 1) * 30 ? '√ ' : '⏳ '}
                      {model}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="win98-groupbox" style={{ marginBottom: '16px', borderColor: '#ff0000' }}>
              <legend>Error</legend>
              <div style={{ padding: '8px', background: '#ffcccc' }}>
                <p className="win98-text-bold" style={{ marginBottom: '4px', color: '#cc0000' }}>
                  Couldn't get consensus
                </p>
                <p style={{ marginBottom: '8px', fontSize: '11px' }}>{error}</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      setError(null);
                      if (question.trim()) {
                        const form = new Event('submit', { bubbles: true, cancelable: true });
                        Object.defineProperty(form, 'preventDefault', {
                          value: () => { },
                          writable: false
                        });
                        handleAsk(form as unknown as React.FormEvent);
                      }
                    }}
                    className="win98-button"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => setError(null)}
                    className="win98-button"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Answer */}
          {answer && (
            <div style={{ marginBottom: '16px' }}>
              {/* Tools */}
              <div style={{ marginBottom: '16px' }}>
                {answer.answer.tools.map((tool, index) => (
                  <div key={index} className="win98-groupbox" style={{ marginBottom: '12px' }}>
                    <legend>Tool #{index + 1}</legend>
                    <div style={{ padding: '8px' }}>
                      <p className="win98-text-lg win98-text-bold" style={{ marginBottom: '4px' }}>
                        <a
                          href={tool.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="win98-link"
                        >
                          {tool.name}
                        </a>
                      </p>
                      <p style={{ marginBottom: '8px', fontSize: '11px' }}>{tool.description}</p>

                      <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
                        <div style={{ marginBottom: '4px' }}>
                          <span className="win98-text-bold">Maker:</span> {tool.maker}
                        </div>
                        <div style={{ marginBottom: '4px' }}>
                          <span className="win98-text-bold">Use case:</span> {tool.useCase}
                        </div>
                        <div style={{ marginBottom: '4px', color: '#008000' }}>
                          <span className="win98-text-bold">Proof:</span> {tool.proof}
                        </div>
                        <div style={{ marginBottom: '8px', color: '#808000' }}>
                          <span className="win98-text-bold">Downside:</span> {tool.downside}
                        </div>
                        <a
                          href={tool.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="win98-link"
                        >
                          → Visit website
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Trust Badge */}
              {answer.trustBadge && (
                <div className="win98-groupbox" style={{ marginBottom: '16px', background: '#c8f0c8' }}>
                  <legend>✓ Cross-Verified Answer</legend>
                  <div style={{ padding: '8px' }}>
                    <p style={{ marginBottom: '12px', fontSize: '11px' }}>
                      {answer.trustBadge.message}
                    </p>

                    {/* Consensus Metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
                      <div className="win98-field-border" style={{ padding: '6px', textAlign: 'center' }}>
                        <div className="win98-text-xs" style={{ marginBottom: '2px' }}>Consensus</div>
                        <div className="win98-text-xl win98-text-bold">{answer.trustBadge.consensusScore}%</div>
                      </div>
                      <div className="win98-field-border" style={{ padding: '6px', textAlign: 'center' }}>
                        <div className="win98-text-xs" style={{ marginBottom: '2px' }}>Models</div>
                        <div className="win98-text-xl win98-text-bold">
                          {answer.trustBadge.modelsUsed}/{answer.trustBadge.modelsQueried}
                        </div>
                      </div>
                      <div className="win98-field-border" style={{ padding: '6px', textAlign: 'center' }}>
                        <div className="win98-text-xs" style={{ marginBottom: '2px' }}>Diversity</div>
                        <div className="win98-text-xl win98-text-bold">{answer.trustBadge.diversityScore}%</div>
                      </div>
                      <div className="win98-field-border" style={{ padding: '6px', textAlign: 'center' }}>
                        <div className="win98-text-xs" style={{ marginBottom: '2px' }}>Agreement</div>
                        <div className="win98-text-sm win98-text-bold">
                          {answer.trustBadge.breakdown.unanimous} all
                          <br />
                          {answer.trustBadge.breakdown.majority} most
                        </div>
                      </div>
                    </div>

                    {/* Methodology Link */}
                    {answer.methodologyUrl && (
                      <div style={{ textAlign: 'center' }}>
                        <Link href={answer.methodologyUrl} className="win98-button">
                          View Full Methodology →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Timeline Link */}
              <div style={{ marginBottom: '16px' }}>
                <Link
                  href={`/question/${answer.questionId}/timeline`}
                  className="win98-button"
                  style={{ display: 'block', textAlign: 'center' }}
                >
                  📊 View Answer Timeline
                </Link>
              </div>

              {/* Subscribe Section */}
              {showSubscribe && !subscribed && (
                <div className="win98-groupbox" style={{ marginBottom: '16px' }}>
                  <legend>📧 Subscribe to Updates</legend>
                  <div style={{ padding: '8px' }}>
                    <p style={{ marginBottom: '8px', fontSize: '11px' }}>
                      Want updates when this answer changes? We'll re-check on your schedule.
                    </p>

                    <form onSubmit={handleSubscribe}>
                      <div style={{ marginBottom: '8px' }}>
                        <label className="win98-text-sm win98-text-bold" style={{ display: 'block', marginBottom: '4px' }}>
                          Delivery method:
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                          {(['email', 'sms', 'both'] as const).map((method) => (
                            <button
                              key={method}
                              type="button"
                              onClick={() => setDeliveryMethod(method)}
                              className="win98-button"
                              style={{
                                background: deliveryMethod === method ? '#000080' : '#c0c0c0',
                                color: deliveryMethod === method ? '#ffffff' : '#000000',
                              }}
                            >
                              {method === 'email' ? 'Email' : method === 'sms' ? 'SMS' : 'Both'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {(deliveryMethod === 'email' || deliveryMethod === 'both') && (
                        <div style={{ marginBottom: '8px' }}>
                          <label className="win98-text-sm" style={{ display: 'block', marginBottom: '4px' }}>Email:</label>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="win98-input"
                            style={{ width: '100%', padding: '4px' }}
                            required={deliveryMethod === 'email' || deliveryMethod === 'both'}
                          />
                        </div>
                      )}

                      {(deliveryMethod === 'sms' || deliveryMethod === 'both') && (
                        <div style={{ marginBottom: '8px' }}>
                          <label className="win98-text-sm" style={{ display: 'block', marginBottom: '4px' }}>Phone:</label>
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+1 (555) 123-4567"
                            className="win98-input"
                            style={{ width: '100%', padding: '4px' }}
                            required={deliveryMethod === 'sms' || deliveryMethod === 'both'}
                          />
                        </div>
                      )}

                      <div style={{ marginBottom: '8px' }}>
                        <label className="win98-text-sm" style={{ display: 'block', marginBottom: '4px' }}>Frequency:</label>
                        <select
                          value={frequencyDays}
                          onChange={(e) => setFrequencyDays(Number(e.target.value))}
                          className="win98-input"
                          style={{ width: '100%', padding: '4px' }}
                        >
                          <option value={1}>Daily</option>
                          <option value={3}>Every 3 days</option>
                          <option value={7}>Weekly</option>
                          <option value={14}>Every 2 weeks</option>
                          <option value={30}>Monthly</option>
                        </select>
                      </div>

                      <div style={{ marginBottom: '8px' }}>
                        <label className="win98-text-sm" style={{ display: 'block', marginBottom: '4px' }}>Notify me:</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => setNotifyOnChangeOnly(true)}
                            className="win98-button"
                            style={{
                              background: notifyOnChangeOnly ? '#000080' : '#c0c0c0',
                              color: notifyOnChangeOnly ? '#ffffff' : '#000000',
                              textAlign: 'left',
                              padding: '6px',
                            }}
                          >
                            Only when answer changes
                          </button>
                          <button
                            type="button"
                            onClick={() => setNotifyOnChangeOnly(false)}
                            className="win98-button"
                            style={{
                              background: !notifyOnChangeOnly ? '#000080' : '#c0c0c0',
                              color: !notifyOnChangeOnly ? '#ffffff' : '#000000',
                              textAlign: 'left',
                              padding: '6px',
                            }}
                          >
                            Every time (even if no changes)
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={subscribing}
                        className="win98-button win98-button-default"
                        style={{ width: '100%', padding: '8px' }}
                      >
                        {subscribing ? 'Subscribing...' : 'Subscribe to Updates'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Verification Step */}
              {showVerification && !subscribed && (
                <div className="win98-groupbox" style={{ marginBottom: '16px', background: '#c8e0ff' }}>
                  <legend>📧 Verify Your Contact</legend>
                  <div style={{ padding: '8px' }}>
                    <p style={{ marginBottom: '8px', fontSize: '11px' }}>
                      We sent a 6-digit code to {deliveryMethod === 'email' ? email : deliveryMethod === 'sms' ? phone : `${email} and ${phone}`}.
                    </p>

                    {verificationError && (
                      <div style={{ padding: '6px', background: '#ffcccc', marginBottom: '8px', border: '1px solid #ff0000' }}>
                        <p className="win98-text-sm" style={{ color: '#cc0000' }}>{verificationError}</p>
                      </div>
                    )}

                    <form onSubmit={handleVerify}>
                      <div style={{ marginBottom: '8px' }}>
                        <label className="win98-text-sm" style={{ display: 'block', marginBottom: '4px' }}>Enter code:</label>
                        <input
                          type="text"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          maxLength={6}
                          className="win98-input"
                          style={{ width: '100%', padding: '8px', textAlign: 'center', fontSize: '18px', letterSpacing: '8px' }}
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={verifying || verificationCode.length !== 6}
                        className="win98-button win98-button-default"
                        style={{ width: '100%', padding: '8px', marginBottom: '4px' }}
                      >
                        {verifying ? 'Verifying...' : 'Verify & Activate'}
                      </button>

                      <button
                        type="button"
                        onClick={handleResendCode}
                        className="win98-button"
                        style={{ width: '100%', padding: '6px' }}
                      >
                        Resend Code
                      </button>
                    </form>

                    <p className="win98-text-xs" style={{ marginTop: '8px', textAlign: 'center', color: '#666' }}>
                      Code expires in 10 minutes
                    </p>
                  </div>
                </div>
              )}

              {/* Subscribed Confirmation */}
              {subscribed && (
                <div className="win98-groupbox" style={{ background: '#c8f0c8' }}>
                  <legend>✓ Subscribed!</legend>
                  <div style={{ padding: '8px', textAlign: 'center' }}>
                    <p className="win98-text-lg win98-text-bold" style={{ marginBottom: '4px' }}>
                      You're verified & subscribed!
                    </p>
                    <p className="win98-text-sm">
                      We'll send updates for "{answer?.question}" every{' '}
                      {frequencyDays === 1 ? 'day' : frequencyDays === 7 ? 'week' : `${frequencyDays} days`}
                      {deliveryMethod === 'email' && ' via email'}
                      {deliveryMethod === 'sms' && ' via SMS'}
                      {deliveryMethod === 'both' && ' via email and SMS'}.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Example Questions */}
          {!answer && !loading && (
            <div className="win98-groupbox">
              <legend>Example questions</legend>
              <div style={{ padding: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
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
                      className="win98-button"
                      style={{ padding: '8px', textAlign: 'left', fontSize: '10px' }}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="win98-status-bar">
          <div className="win98-status-field" style={{ flex: 2 }}>
            Ready | Powered by AI Consensus
          </div>
          <div className="win98-status-field">
            {answer ? `${answer.answer.tools.length} tools found` : 'No results'}
          </div>
          <div className="win98-status-field">
            {currentTime}
          </div>
        </div>
      </div>
    </div>
  );
}
