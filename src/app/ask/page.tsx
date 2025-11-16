'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Bouncing search box state
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [velocity, setVelocity] = useState({ x: 0.8, y: 0.6 });
  const [boxColor, setBoxColor] = useState('#FFFFFF');

  // Bouncing animation (DVD screensaver style)
  useEffect(() => {
    if (loading || answer || showGameOver || showResults) return;

    const interval = setInterval(() => {
      setPosition((prev) => {
        const box = searchBoxRef.current;
        if (!box) return prev;

        const boxWidth = 400;
        const boxHeight = 200;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        let newX = prev.x + velocity.x;
        let newY = prev.y + velocity.y;
        let newVelX = velocity.x;
        let newVelY = velocity.y;

        // Bounce off walls and change color
        if (newX + boxWidth >= windowWidth || newX <= 0) {
          newVelX = -newVelX;
          setBoxColor(`#${Math.floor(Math.random()*16777215).toString(16)}`);
        }
        if (newY + boxHeight >= windowHeight || newY <= 60) { // 60 for taskbar
          newVelY = -newVelY;
          setBoxColor(`#${Math.floor(Math.random()*16777215).toString(16)}`);
        }

        // Keep in bounds
        newX = Math.max(0, Math.min(newX, windowWidth - boxWidth));
        newY = Math.max(60, Math.min(newY, windowHeight - boxHeight));

        setVelocity({ x: newVelX, y: newVelY });

        return { x: newX, y: newY };
      });
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [velocity, loading, answer, showGameOver, showResults]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    setAnswer(null);

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
      setAnswer(data);
      setShowResults(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setShowGameOver(true);
  };

  const handleRestart = () => {
    window.location.reload();
  };

  // Game Over Screen
  if (showGameOver) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Courier New", monospace',
        color: '#FF0000',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{
          fontSize: '72px',
          fontWeight: 'bold',
          textShadow: '4px 4px 0px rgba(255, 0, 0, 0.5)',
          animation: 'blink 1s infinite'
        }}>
          GAME OVER
        </div>
        <div style={{
          fontSize: '24px',
          color: '#FFFFFF',
          textAlign: 'center'
        }}>
          YOU CLOSED THE WINDOW<br/>
          YOU LOSE
        </div>
        <div style={{
          fontSize: '18px',
          color: '#00FF00',
          marginTop: '40px',
          border: '2px solid #00FF00',
          padding: '10px 20px',
          cursor: 'pointer'
        }} onClick={handleRestart}>
          PRESS F5 TO CONTINUE
        </div>
        <div style={{
          fontSize: '12px',
          color: '#888888',
          marginTop: '20px'
        }}>
          (or just refresh the page)
        </div>
        <style jsx>{`
          @keyframes blink {
            0%, 49% { opacity: 1; }
            50%, 100% { opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#008080', // Teal Windows 95 background
      overflow: 'hidden',
      fontFamily: 'MS Sans Serif, Arial, sans-serif',
      position: 'relative'
    }}>
      {/* Windows 95 Taskbar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '40px',
        background: '#C0C0C0',
        borderTop: '2px solid #FFFFFF',
        display: 'flex',
        alignItems: 'center',
        padding: '0 4px',
        zIndex: 1000
      }}>
        <button style={{
          background: '#C0C0C0',
          border: '2px outset #FFFFFF',
          padding: '4px 8px',
          fontFamily: 'MS Sans Serif, Arial, sans-serif',
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span style={{ fontSize: '20px' }}>🪟</span>
          Start
        </button>
        <div style={{
          flex: 1,
          marginLeft: '4px',
          background: '#C0C0C0',
          border: '2px inset #808080',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 4px'
        }}>
          <div style={{
            background: '#C0C0C0',
            border: '1px outset #FFFFFF',
            padding: '2px 8px',
            fontSize: '12px'
          }}>
            📄 Scuttle What - Ask
          </div>
        </div>
        <div style={{
          display: 'flex',
          gap: '2px',
          background: '#C0C0C0',
          border: '2px inset #808080',
          padding: '2px 4px'
        }}>
          <div style={{ fontSize: '12px' }}>
            🔊 ⏰ {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Floating/Bouncing Search Box (when no results) */}
      {!loading && !answer && !showResults && (
        <div
          ref={searchBoxRef}
          style={{
            position: 'absolute',
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: '400px',
            background: '#C0C0C0',
            border: '3px outset #FFFFFF',
            boxShadow: '4px 4px 0px rgba(0,0,0,0.5)',
            transition: 'background-color 0.3s'
          }}
        >
          {/* Title Bar */}
          <div style={{
            background: 'linear-gradient(to right, #000080, #1084D0)',
            color: '#FFFFFF',
            padding: '3px 4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>📝</span>
              <span>Scuttle What - Ask Question</span>
            </div>
            <div style={{ display: 'flex', gap: '2px' }}>
              <button style={{
                background: '#C0C0C0',
                border: '1px outset #FFFFFF',
                width: '16px',
                height: '14px',
                fontSize: '10px',
                cursor: 'pointer',
                padding: '0',
                lineHeight: '1'
              }}>_</button>
              <button style={{
                background: '#C0C0C0',
                border: '1px outset #FFFFFF',
                width: '16px',
                height: '14px',
                fontSize: '10px',
                cursor: 'pointer',
                padding: '0',
                lineHeight: '1'
              }}>□</button>
              <button onClick={handleClose} style={{
                background: '#C0C0C0',
                border: '1px outset #FFFFFF',
                width: '16px',
                height: '14px',
                fontSize: '10px',
                cursor: 'pointer',
                padding: '0',
                lineHeight: '1'
              }}>✕</button>
            </div>
          </div>

          {/* Window Content */}
          <div style={{
            padding: '16px',
            background: boxColor,
            borderTop: '1px solid #808080'
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 'bold',
              marginBottom: '12px',
              color: '#000000'
            }}>
              Which SaaS tool should you actually use?
            </div>
            <div style={{
              fontSize: '11px',
              marginBottom: '16px',
              color: '#000000'
            }}>
              We ask 3 leading AI models (Claude, GPT-4o, DeepSeek), then show you only what they agree on.
            </div>

            <form onSubmit={handleAsk}>
              <div style={{
                marginBottom: '12px'
              }}>
                <label style={{
                  fontSize: '11px',
                  fontWeight: 'bold',
                  display: 'block',
                  marginBottom: '4px',
                  color: '#000000'
                }}>
                  Enter your question:
                </label>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g., Best CRM for small sales teams"
                  style={{
                    width: '100%',
                    padding: '4px',
                    border: '2px inset #808080',
                    background: '#FFFFFF',
                    fontFamily: 'MS Sans Serif, Arial, sans-serif',
                    fontSize: '11px'
                  }}
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !question.trim()}
                style={{
                  background: '#C0C0C0',
                  border: loading ? '2px inset #808080' : '2px outset #FFFFFF',
                  padding: '6px 24px',
                  fontFamily: 'MS Sans Serif, Arial, sans-serif',
                  fontSize: '11px',
                  cursor: loading ? 'default' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {loading ? '⏳ Querying Models...' : 'OK'}
              </button>
            </form>

            <div style={{
              marginTop: '12px',
              fontSize: '10px',
              color: '#000000',
              border: '1px solid #808080',
              padding: '8px',
              background: '#FFFFE0'
            }}>
              💡 <strong>Tip:</strong> Try "Best sales engagement tool" or "Salesforce vs HubSpot"
            </div>
          </div>
        </div>
      )}

      {/* Loading Screen (Old Windows hourglass style) */}
      {loading && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '450px',
          background: '#C0C0C0',
          border: '3px outset #FFFFFF',
          boxShadow: '4px 4px 0px rgba(0,0,0,0.5)'
        }}>
          <div style={{
            background: 'linear-gradient(to right, #000080, #1084D0)',
            color: '#FFFFFF',
            padding: '3px 4px',
            fontSize: '12px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span>⏳</span>
            <span>Please Wait...</span>
          </div>
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '16px' }}>
              Cross-referencing AI models...
            </div>
            <div style={{
              background: '#FFFFFF',
              border: '2px inset #808080',
              height: '24px',
              margin: '16px 0',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: '33%',
                background: 'repeating-linear-gradient(45deg, #000080, #000080 10px, #1084D0 10px, #1084D0 20px)',
                animation: 'progress 2s linear infinite'
              }}></div>
            </div>
            <div style={{ fontSize: '11px', color: '#000000' }}>
              ■ Claude Sonnet 4.5<br/>
              ■ GPT-4o<br/>
              ■ DeepSeek Chat
            </div>
          </div>
          <style jsx>{`
            @keyframes progress {
              0% { transform: translateX(0); }
              100% { transform: translateX(300%); }
            }
          `}</style>
        </div>
      )}

      {/* Error Dialog (Windows 95 style) */}
      {error && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '400px',
          background: '#C0C0C0',
          border: '3px outset #FFFFFF',
          boxShadow: '4px 4px 0px rgba(0,0,0,0.5)',
          zIndex: 100
        }}>
          <div style={{
            background: 'linear-gradient(to right, #000080, #1084D0)',
            color: '#FFFFFF',
            padding: '3px 4px',
            fontSize: '12px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span>⚠️</span>
            <span>Error</span>
          </div>
          <div style={{ padding: '24px', display: 'flex', gap: '16px' }}>
            <div style={{ fontSize: '48px' }}>❌</div>
            <div>
              <div style={{ fontSize: '11px', marginBottom: '16px' }}>
                {error}
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setError(null);
                    handleAsk(new Event('submit') as any);
                  }}
                  style={{
                    background: '#C0C0C0',
                    border: '2px outset #FFFFFF',
                    padding: '4px 16px',
                    fontFamily: 'MS Sans Serif, Arial, sans-serif',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  Retry
                </button>
                <button
                  onClick={() => setError(null)}
                  style={{
                    background: '#C0C0C0',
                    border: '2px outset #FFFFFF',
                    padding: '4px 16px',
                    fontFamily: 'MS Sans Serif, Arial, sans-serif',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Window */}
      {showResults && answer && (
        <div style={{
          position: 'fixed',
          top: '60px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '800px',
          maxHeight: 'calc(100vh - 120px)',
          background: '#C0C0C0',
          border: '3px outset #FFFFFF',
          boxShadow: '4px 4px 0px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Title Bar */}
          <div style={{
            background: 'linear-gradient(to right, #000080, #1084D0)',
            color: '#FFFFFF',
            padding: '3px 4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>📊</span>
              <span>Consensus Results - {answer.question}</span>
            </div>
            <div style={{ display: 'flex', gap: '2px' }}>
              <button onClick={() => setShowResults(false)} style={{
                background: '#C0C0C0',
                border: '1px outset #FFFFFF',
                width: '16px',
                height: '14px',
                fontSize: '10px',
                cursor: 'pointer',
                padding: '0'
              }}>✕</button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            background: '#FFFFFF',
            padding: '16px'
          }}>
            {/* Trust Badge */}
            {answer.trustBadge && (
              <div style={{
                background: '#C0C0C0',
                border: '2px inset #808080',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
                  ✓ Cross-Verified Answer
                </div>
                <div style={{ fontSize: '10px', marginBottom: '8px' }}>
                  {answer.trustBadge.message}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '10px' }}>
                  <div style={{ background: '#FFFFFF', border: '1px solid #808080', padding: '4px', textAlign: 'center' }}>
                    <strong>Consensus:</strong><br/>{answer.trustBadge.consensusScore}%
                  </div>
                  <div style={{ background: '#FFFFFF', border: '1px solid #808080', padding: '4px', textAlign: 'center' }}>
                    <strong>Models:</strong><br/>{answer.trustBadge.modelsUsed}/{answer.trustBadge.modelsQueried}
                  </div>
                  <div style={{ background: '#FFFFFF', border: '1px solid #808080', padding: '4px', textAlign: 'center' }}>
                    <strong>Diversity:</strong><br/>{answer.trustBadge.diversityScore}%
                  </div>
                </div>
              </div>
            )}

            {/* Tools List */}
            {answer.answer.tools.map((tool, index) => (
              <div key={index} style={{
                background: '#C0C0C0',
                border: '2px outset #FFFFFF',
                padding: '12px',
                marginBottom: '12px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
                  {index + 1}. {tool.name}
                </div>
                <div style={{ fontSize: '10px', marginBottom: '8px', lineHeight: '1.4' }}>
                  {tool.description}
                </div>
                <div style={{ fontSize: '9px', lineHeight: '1.6' }}>
                  <div><strong>Maker:</strong> {tool.maker}</div>
                  <div><strong>Use case:</strong> {tool.useCase}</div>
                  <div><strong>Proof:</strong> {tool.proof}</div>
                  <div style={{ color: '#CC0000' }}><strong>Downside:</strong> {tool.downside}</div>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <a href={tool.link} target="_blank" rel="noopener noreferrer" style={{
                    color: '#0000FF',
                    textDecoration: 'underline',
                    fontSize: '10px'
                  }}>
                    Visit website →
                  </a>
                </div>
              </div>
            ))}

            {/* Market Signals */}
            {answer.signals && (
              <div style={{
                background: '#FFFFE0',
                border: '1px solid #808080',
                padding: '12px',
                marginTop: '16px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' }}>
                  📊 Market Signals
                </div>
                <div style={{ fontSize: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <strong>Market Intent:</strong> {answer.signals.marketIntent.score}/100
                    <br/>
                    <span style={{ fontSize: '9px' }}>
                      Trend: {answer.signals.marketIntent.trend}
                    </span>
                  </div>
                  <div>
                    <strong>Market Saturation:</strong> {answer.signals.marketSaturation.score}%
                    <br/>
                    <span style={{ fontSize: '9px' }}>
                      {answer.signals.marketSaturation.competitorsFound} competitors
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Buttons */}
          <div style={{
            background: '#C0C0C0',
            borderTop: '1px solid #808080',
            padding: '8px',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <button
              onClick={() => {
                setShowResults(false);
                setAnswer(null);
                setQuestion('');
              }}
              style={{
                background: '#C0C0C0',
                border: '2px outset #FFFFFF',
                padding: '4px 16px',
                fontFamily: 'MS Sans Serif, Arial, sans-serif',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              New Search
            </button>
            <button
              onClick={() => setShowResults(false)}
              style={{
                background: '#C0C0C0',
                border: '2px outset #FFFFFF',
                padding: '4px 16px',
                fontFamily: 'MS Sans Serif, Arial, sans-serif',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
