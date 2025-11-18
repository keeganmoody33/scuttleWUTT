'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Plus, RefreshCw, Trash2, AlertCircle, BarChart3 } from 'lucide-react';
import Link from 'next/link';

interface BrandTracker {
    id: string;
    brandName: string;
    trackedPrompts: string[];

    // Metrics
    shareOfVoice: number;
    sentimentScore: number;
    consensusScore: number;
    providerBias: Array<{
        provider: string;
        sentiment: number;
        shareOfVoice: number;
    }>;

    lastCheckedAt: string | null;
    nextCheckAt: string;
    alertsEnabled: boolean;
    active: boolean;
}

export default function BrandIntelPage() {
    const [trackers, setTrackers] = useState<BrandTracker[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    // Add tracker form state
    const [brandName, setBrandName] = useState('');
    const [prompts, setPrompts] = useState('');
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        loadTrackers();
    }, []);

    const loadTrackers = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/brand-trackers');

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

        if (!brandName.trim() || !prompts.trim()) {
            alert('Please provide both brand name and at least one prompt');
            return;
        }

        const promptList = prompts
            .split('\n')
            .map((p) => p.trim())
            .filter((p) => p.length >= 5);

        if (promptList.length === 0) {
            alert('Please provide at least one valid prompt (minimum 5 characters each)');
            return;
        }

        setAdding(true);

        try {
            const response = await fetch('/api/brand-trackers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    brandName: brandName.trim(),
                    trackedPrompts: promptList,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create tracker');
            }

            // Reset form and reload
            setBrandName('');
            setPrompts('');
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
            const response = await fetch(`/api/brand-trackers/${trackerId}`, {
                method: 'PUT',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to refresh tracker');
            }

            await loadTrackers();
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to refresh tracker');
        }
    };

    const handleDelete = async (trackerId: string) => {
        if (!confirm('Are you sure you want to delete this brand tracker?')) return;

        try {
            const response = await fetch(`/api/brand-trackers/${trackerId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete tracker');
            }

            await loadTrackers();
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to delete tracker');
        }
    };

    const getSentimentColor = (score: number) => {
        if (score >= 70) return 'text-green-600';
        if (score >= 40) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getSentimentLabel = (score: number) => {
        if (score >= 70) return 'Positive';
        if (score >= 40) return 'Neutral';
        return 'Negative';
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold mb-2">Brand Intel Engine</h1>
                    <p className="text-gray-600">
                        Track how LLMs recommend your brand across multiple prompts and models
                    </p>
                </div>

                <div className="mb-6 flex justify-between items-center">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Brand Tracker
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="mt-4 text-gray-600">Loading brand trackers...</p>
                    </div>
                ) : trackers.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                        <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-4">No brand trackers yet</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            Create Your First Tracker
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {trackers.map((tracker) => (
                            <div
                                key={tracker.id}
                                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h2 className="text-2xl font-bold mb-2">{tracker.brandName}</h2>
                                        <p className="text-sm text-gray-600">
                                            Tracking {tracker.trackedPrompts.length} prompt{tracker.trackedPrompts.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleRefresh(tracker.id)}
                                            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm flex items-center gap-1"
                                            title="Refresh tracker"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(tracker.id)}
                                            className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-sm flex items-center gap-1"
                                            title="Delete tracker"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div className="bg-blue-50 rounded-lg p-4">
                                        <div className="text-sm text-gray-600 mb-1">Share of Voice</div>
                                        <div className="text-2xl font-bold">{tracker.shareOfVoice}%</div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {tracker.shareOfVoice >= 70
                                                ? 'High visibility'
                                                : tracker.shareOfVoice >= 40
                                                    ? 'Moderate visibility'
                                                    : 'Low visibility'}
                                        </div>
                                    </div>

                                    <div className="bg-green-50 rounded-lg p-4">
                                        <div className="text-sm text-gray-600 mb-1">Sentiment Score</div>
                                        <div className={`text-2xl font-bold ${getSentimentColor(tracker.sentimentScore)}`}>
                                            {tracker.sentimentScore}/100
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">{getSentimentLabel(tracker.sentimentScore)}</div>
                                    </div>

                                    <div className="bg-purple-50 rounded-lg p-4">
                                        <div className="text-sm text-gray-600 mb-1">Consensus Score</div>
                                        <div className="text-2xl font-bold">{tracker.consensusScore}%</div>
                                        <div className="text-xs text-gray-500 mt-1">Model agreement</div>
                                    </div>
                                </div>

                                {tracker.providerBias && tracker.providerBias.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-gray-200">
                                        <div className="text-sm font-semibold mb-2">Provider Bias Analysis</div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {tracker.providerBias.map((bias, idx) => (
                                                <div key={idx} className="bg-gray-50 rounded p-2 text-xs">
                                                    <div className="font-medium">{bias.provider}</div>
                                                    <div className="text-gray-600">SOV: {bias.shareOfVoice}%</div>
                                                    <div className={bias.sentiment >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                        Sentiment: {bias.sentiment >= 0 ? '+' : ''}
                                                        {bias.sentiment.toFixed(1)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <div className="text-sm font-semibold mb-2">Tracked Prompts</div>
                                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                                        {tracker.trackedPrompts.map((prompt, idx) => (
                                            <li key={idx}>{prompt}</li>
                                        ))}
                                    </ul>
                                </div>

                                {tracker.lastCheckedAt && (
                                    <div className="mt-4 text-xs text-gray-500">
                                        Last checked: {new Date(tracker.lastCheckedAt).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Add Tracker Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                            <h2 className="text-2xl font-bold mb-4">Add Brand Tracker</h2>

                            <form onSubmit={handleAddTracker} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-2">Brand Name</label>
                                    <input
                                        type="text"
                                        value={brandName}
                                        onChange={(e) => setBrandName(e.target.value)}
                                        placeholder="e.g., Salesforce"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold mb-2">Prompts to Track</label>
                                    <p className="text-xs text-gray-600 mb-2">
                                        Enter one prompt per line. Each prompt should be at least 5 characters.
                                    </p>
                                    <textarea
                                        value={prompts}
                                        onChange={(e) => setPrompts(e.target.value)}
                                        placeholder="best CRM&#10;Salesforce vs HubSpot&#10;alternatives to Salesforce"
                                        rows={6}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                                        required
                                    />
                                </div>

                                <div className="flex gap-3 justify-end">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowAddModal(false);
                                            setBrandName('');
                                            setPrompts('');
                                        }}
                                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={adding}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                                    >
                                        {adding ? 'Creating...' : 'Create Tracker'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

