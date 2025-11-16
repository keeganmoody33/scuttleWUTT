'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Plus, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface OpportunityTracker {
  id: string;
  ideaName: string;
  keywords: string[];

  // Market signals
  intentScore: number;
  intentTrend: 'rising' | 'falling' | 'flat';
  saturationScore: number;
  competitiveConsensus: number;

  // Opportunity window
  opportunityScore: number;
  windowStatus: 'wide_open' | 'emerging' | 'closing' | 'saturated' | 'unknown';

  lastCheckedAt: string;
  nextCheckAt: string;
  alertsEnabled: boolean;
}

export default function AlphaPage() {
  const [trackers, setTrackers] = useState<OpportunityTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add tracker form state
  const [ideaName, setIdeaName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadTrackers();
  }, []);

  const loadTrackers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/alpha');

      if (response.ok) {
        const data = await response.json();
        setTrackers(data.trackers || []);
      }
    } catch (error) {
      console.error('Failed to load trackers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTracker = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ideaName.trim() || !keywords.trim()) {
      alert('Please provide both idea name and keywords');
      return;
    }

    setAdding(true);

    try {
      const response = await fetch('/api/alpha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ideaName: ideaName.trim(),
          keywords: keywords.split(',').map(k => k.trim()).filter(k => k.length > 0),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create tracker');
      }

      // Reset form and reload
      setIdeaName('');
      setKeywords('');
      setShowAddModal(false);
      await loadTrackers();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create tracker');
    } finally {
      setAdding(false);
    }
  };

  const handleRefresh = async (trackerId: string) => {
    try {
      const response = await fetch(`/api/alpha/${trackerId}`, {
        method: 'PUT',
      });

      if (!response.ok) {
        throw new Error('Failed to refresh tracker');
      }

      await loadTrackers();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to refresh tracker');
    }
  };

  const handleDelete = async (trackerId: string) => {
    if (!confirm('Are you sure you want to delete this tracker?')) return;

    try {
      const response = await fetch(`/api/alpha/${trackerId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete tracker');
      }

      await loadTrackers();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete tracker');
    }
  };

  const getWindowStatusColor = (status: string) => {
    switch (status) {
      case 'wide_open': return 'bg-green-100 text-green-800 border-green-300';
      case 'emerging': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'closing': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'saturated': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getWindowStatusLabel = (status: string) => {
    switch (status) {
      case 'wide_open': return '🚀 Wide Open';
      case 'emerging': return '📈 Emerging';
      case 'closing': return '⚠️ Closing';
      case 'saturated': return '🔴 Saturated';
      default: return '❓ Unknown';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <nav className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900">
            Scuttle What
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/ask"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Ask
            </Link>
            <Link
              href="/compare"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Compare Models
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-purple-600">Scuttle Alpha</span>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                PRO
              </span>
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Scuttle Alpha: Opportunity Window Tracker
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Track market opportunities in real-time by combining demand signals with AI consensus analysis.
          </p>

          {/* How it Works */}
          <div className="bg-white border border-purple-200 rounded-xl p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">How Opportunity Windows Work</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <div className="font-semibold text-sm text-gray-900">Market Intent</div>
                  <div className="text-xs text-gray-600 mt-1">
                    We track search volume and trends for your keywords using Google Trends data
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <div className="font-semibold text-sm text-gray-900">Market Saturation</div>
                  <div className="text-xs text-gray-600 mt-1">
                    We query 30+ AI models to see how saturated the market is with competitors
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <div>
                  <div className="font-semibold text-sm text-gray-900">Opportunity Score</div>
                  <div className="text-xs text-gray-600 mt-1">
                    High demand + Low saturation = Wide Open opportunity window
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Track New Opportunity
          </button>
        </div>

        {/* Trackers List */}
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Loading trackers...</p>
          </div>
        ) : trackers.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No trackers yet</h3>
            <p className="text-gray-600 mb-6">
              Start tracking market opportunities by adding your first idea.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold"
            >
              Track Your First Opportunity
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {trackers.map((tracker) => (
              <div
                key={tracker.id}
                className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {tracker.ideaName}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {tracker.keywords.map((keyword, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRefresh(tracker.id)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Refresh now"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(tracker.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete tracker"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Opportunity Window Status */}
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-bold mb-4 ${getWindowStatusColor(tracker.windowStatus)}`}>
                  <span className="text-lg">{getWindowStatusLabel(tracker.windowStatus)}</span>
                  <span className="text-2xl">{tracker.opportunityScore}/100</span>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Market Intent */}
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-600">Market Intent</span>
                      {tracker.intentTrend === 'rising' && (
                        <TrendingUp className="w-3 h-3 text-green-600" />
                      )}
                      {tracker.intentTrend === 'falling' && (
                        <TrendingDown className="w-3 h-3 text-red-600" />
                      )}
                    </div>
                    <div className="text-2xl font-bold text-blue-700">
                      {tracker.intentScore}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      {tracker.intentTrend}
                    </div>
                  </div>

                  {/* Market Saturation */}
                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Saturation</div>
                    <div className="text-2xl font-bold text-purple-700">
                      {tracker.saturationScore}%
                    </div>
                    <div className="text-xs text-purple-600 mt-1">
                      {tracker.competitiveConsensus} competitors
                    </div>
                  </div>

                  {/* Last Checked */}
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Last Checked</div>
                    <div className="text-sm font-bold text-gray-900">
                      {new Date(tracker.lastCheckedAt).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {new Date(tracker.lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {/* Next Check */}
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Next Check</div>
                    <div className="text-sm font-bold text-green-900">
                      {new Date(tracker.nextCheckAt).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      Auto-refresh
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Tracker Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Track New Opportunity</h2>

            <form onSubmit={handleAddTracker} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Idea Name
                </label>
                <input
                  type="text"
                  value={ideaName}
                  onChange={(e) => setIdeaName(e.target.value)}
                  placeholder="e.g., AI-powered sales assistant"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="ai sales assistant, sales automation, ai outreach"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  These keywords will be tracked for market intent and saturation
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setIdeaName('');
                    setKeywords('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-semibold"
                >
                  {adding ? 'Creating...' : 'Create Tracker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
