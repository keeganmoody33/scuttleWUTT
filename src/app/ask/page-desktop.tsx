'use client';

import { useState, useEffect, useRef } from 'react';
import DraggableWindow from '@/components/DraggableWindow';
import DesktopIcon from '@/components/DesktopIcon';
import Link from 'next/link';

interface Tool {
  name: string;
  description: string;
  maker: string;
  useCase: string;
  proof: string;
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

export default function AskPageDesktop() {
  const [openWindows, setOpenWindows] = useState<Set<string>>(new Set(['ask']));
  const [currentTime, setCurrentTime] = useState('Loading...');
  const [currentExampleIndex, setCurrentExampleIndex] = useState(0);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const progressIntervalRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const exampleQuestions = [
    'Top 5 NFL teams',
    'best-in-box co-pilot for sales teams',
    'AI tools for content creation',
    'CRM for small businesses',
  ];

  // Update time every second (client-side only to avoid hydration errors)
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Rotate example questions every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentExampleIndex((prev) => (prev + 1) % exampleQuestions.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [exampleQuestions.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim()) return;

    if (mountedRef.current) {
      setLoading(true);
      setLoadingProgress(0);
      setError(null);
      setAnswer(null);
    }

    // Simulate progress for better UX
    progressIntervalRef.current = window.setInterval(() => {
      if (mountedRef.current) {
        setLoadingProgress((prev) => {
          if (prev >= 90) return prev; // Cap at 90% until real response
          return prev + Math.random() * 15;
        });
      }
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
      if (mountedRef.current) {
        setLoadingProgress(100);
        setAnswer(data);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    } finally {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setTimeout(() => {
        if (mountedRef.current) {
          setLoading(false);
          setLoadingProgress(0);
        }
      }, 300);
    }
  };

  const toggleWindow = (windowId: string) => {
    setOpenWindows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(windowId)) {
        newSet.delete(windowId);
      } else {
        newSet.add(windowId);
      }
      return newSet;
    });
  };

  return (
    <div className={`win98-desktop ${loading ? 'searching' : ''}`} style={{ minHeight: '100vh', position: 'relative' }}>

      {/* Desktop Icons */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          zIndex: 1,
        }}
      >
        <DesktopIcon
          icon="📬"
          label="ScuttleWUTT Ask"
          onClick={() => toggleWindow('ask')}
        />
        <DesktopIcon
          icon="📊"
          label="Compare Models"
          onClick={() => (window.location.href = '/compare')}
        />
        <DesktopIcon
          icon="📈"
          label="Scuttle Alpha"
          onClick={() => (window.location.href = '/alpha')}
        />
        <DesktopIcon
          icon="🍑"
          label="Booty"
          onClick={() => alert('Ahoy matey! 😉')}
        />
        <DesktopIcon
          icon="🎮"
          label="Pinball"
          onClick={() => alert('Coming soon!')}
        />
        <DesktopIcon
          icon="⚓"
          label="Ahoy! Need Help?"
          onClick={() => alert('Pirate help coming soon! 🏴‍☠️')}
        />
      </div>

      {/* Draggable Windows */}
      {openWindows.has('ask') && (
        <DraggableWindow
          title="ScuttleWUTT - What's the scuttlebutt?"
          icon="📬"
          defaultPosition={{ x: 150, y: 80 }}
          defaultSize={{ width: 800, height: 600 }}
          onClose={() => toggleWindow('ask')}
          showFlag={true}
          menuItems={[
            { label: 'File', href: '/' },
            { label: 'Edit' },
            { label: 'View' },
            { label: 'Compare', href: '/compare' },
            { label: 'Alpha', href: '/alpha' },
            { label: 'Help' },
          ]}
        >
          <div>
            {/* Header Section */}
            <div className="win98-groupbox" style={{ marginBottom: '16px' }}>
              <legend>About this tool</legend>
              <div style={{ padding: '8px' }}>
                <p className="win98-text-lg win98-text-bold" style={{ marginBottom: '8px' }}>
                  Which SaaS tool should you actually use?
                </p>
                <p style={{ marginBottom: '4px' }}>
                  We ask 2 leading AI models, then show you only what they agree on.
                </p>
                <p style={{ fontSize: '10px', color: '#666' }}>
                  Cross-verified by Claude Sonnet 4.5 and GPT-4o
                </p>
              </div>
            </div>

            {/* Search Form */}
            <div className="win98-groupbox" style={{ marginBottom: '16px' }}>
              <legend>Ask a question</legend>
              <div style={{ padding: '8px' }}>
                {/* Rotating Example Questions Display */}
                <div style={{ marginBottom: '12px', minHeight: '24px' }}>
                  <div
                    className="rotating-placeholder"
                    style={{
                      fontSize: '11px',
                      color: '#666',
                      fontStyle: 'italic',
                    }}
                  >
                    Try: "{exampleQuestions[currentExampleIndex]}"
                  </div>
                </div>

                <form onSubmit={handleAsk}>
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
                      className="win98-button win98-button-default"
                      style={{ width: '80px' }}
                      disabled={loading || !question.trim()}
                    >
                      {loading ? 'Wait...' : 'Ask'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Loading Progress */}
            {loading && (
              <div className="win98-groupbox" style={{ marginBottom: '16px' }}>
                <legend>Processing your question...</legend>
                <div style={{ padding: '8px' }}>
                  <div className="win98-progress-bar" style={{ marginBottom: '8px' }}>
                    <div
                      className="win98-progress-fill"
                      style={{ width: `${loadingProgress}%` }}
                    />
                  </div>
                  <p style={{ fontSize: '10px', color: '#666' }}>
                    Querying Claude Sonnet 4.5 and GPT-4o...
                  </p>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="win98-groupbox" style={{ marginBottom: '16px', borderColor: '#a00' }}>
                <legend>Error</legend>
                <div style={{ padding: '8px' }}>
                  <p style={{ color: '#a00' }}>{error}</p>
                </div>
              </div>
            )}

            {/* Results Display */}
            {answer && (
              <div className="win98-groupbox" style={{ marginBottom: '16px' }}>
                <legend>Consensus Answer</legend>
                <div style={{ padding: '8px' }}>
                  {answer.trustBadge && (
                    <div style={{ marginBottom: '12px', padding: '8px', background: '#e0e0e0', border: '1px solid #808080' }}>
                      <p style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>
                        ✓ {answer.trustBadge.message}
                      </p>
                      <p style={{ fontSize: '9px', color: '#666' }}>
                        Consensus: {Math.round(answer.trustBadge.consensusScore)}% |
                        Unanimous: {answer.trustBadge.breakdown.unanimous} |
                        Majority: {answer.trustBadge.breakdown.majority}
                      </p>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {answer.answer.tools.map((tool, i) => (
                      <div key={i} className="win98-button" style={{ padding: '8px', textAlign: 'left' }}>
                        <p style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '4px' }}>{tool.name}</p>
                        <p style={{ fontSize: '10px', marginBottom: '4px' }}>{tool.description}</p>
                        <p style={{ fontSize: '9px', color: '#666' }}>Use case: {tool.useCase}</p>
                      </div>
                    ))}
                  </div>
                </div>
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
                        className="win98-button"
                        style={{ padding: '8px', textAlign: 'left', fontSize: '10px' }}
                        onClick={() => setQuestion(example)}
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DraggableWindow>
      )}

      {/* Taskbar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '40px',
          background: 'var(--button-face)',
          borderTop: '2px solid var(--button-highlight)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 4px',
          gap: '4px',
          zIndex: 10000,
        }}
      >
        {/* Start Button */}
        <button
          className="win98-button"
          style={{
            padding: '4px 16px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '16px' }}>🪟</span>
          Start
        </button>

        {/* Task Buttons */}
        {Array.from(openWindows).map((windowId) => (
          <button
            key={windowId}
            className="win98-button"
            style={{
              padding: '4px 12px',
              fontSize: '11px',
              background: '#000080',
              color: '#ffffff',
            }}
            onClick={() => {
              // Focus window (bring to front)
            }}
          >
            📬 ScuttleWUTT Ask
          </button>
        ))}

        {/* Clock */}
        <div
          className="win98-status-field"
          style={{
            marginLeft: 'auto',
            padding: '4px 8px',
            minWidth: '80px',
            textAlign: 'center',
          }}
        >
          {currentTime}
        </div>
      </div>
    </div>
  );
}
