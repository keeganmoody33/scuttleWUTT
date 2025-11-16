'use client';

import { useState } from 'react';
import { Search, Loader2, CheckSquare, Square, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { getAvailableModels, getModelMetadata } from '@/services/llm';
import type { LLMModel } from '@/services/llm';

interface ComparisonResult {
  question: string;
  modelsCompared: number;
  responses: Array<{
    model: LLMModel;
    modelName: string;
    provider: string;
    tools: Array<{
      name: string;
      description: string;
      maker: string;
      useCase: string;
      proof: string;
      downside: string;
      link: string;
    }>;
  }>;
  comparison: {
    tools: Array<{
      tool: any;
      mentionedBy: LLMModel[];
      mentionCount: number;
      consensus: 'unanimous' | 'majority' | 'minority' | 'unique';
    }>;
    overlap: any;
    biasMetrics: {
      diversityScore: number;
      consensusScore: number;
      providerBias: Array<{
        provider: string;
        uniqueTools: number;
        overlap: number;
      }>;
    };
  };
  visualizations: {
    heatMap: Array<{
      model: string;
      modelId: LLMModel;
      provider: string;
      recommendations: Array<{
        tool: string;
        recommended: boolean;
        ranking: number | null;
      }>;
    }>;
    consensusBars: Array<{
      toolName: string;
      mentionCount: number;
      percentage: number;
      consensus: string;
      models: LLMModel[];
    }>;
  };
}

export default function ComparePage() {
  const [question, setQuestion] = useState('');
  const [selectedModels, setSelectedModels] = useState<LLMModel[]>([
    'claude-sonnet-4-5',
    'gpt-4o',
    'deepseek-chat',
  ]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const modelsByProvider = getAvailableModels();

  const handleToggleModel = (model: LLMModel) => {
    setSelectedModels((prev) => {
      if (prev.includes(model)) {
        return prev.filter((m) => m !== model);
      } else {
        return [...prev, model];
      }
    });
  };

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim()) return;
    if (selectedModels.length < 2) {
      alert('Select at least 2 models to compare');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          models: selectedModels,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to compare models');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <nav className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900">
            Scuttle What
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/ask" className="text-gray-600 hover:text-gray-900">
              Ask
            </Link>
            <span className="text-blue-600 font-semibold">Compare Models</span>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            AI Model Comparison
          </h1>
          <p className="text-xl text-gray-600 mb-4">
            Compare 30+ AI models side-by-side to spot bias and find consensus
          </p>
          <p className="text-sm text-gray-500">
            See which tools different AI models recommend for the same question
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleCompare} className="mb-8">
          <div className="relative mb-6">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., Best sales engagement tool for enterprise teams"
              className="w-full px-6 py-4 pr-14 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !question.trim() || selectedModels.length < 2}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Search className="w-6 h-6" />
              )}
            </button>
          </div>

          {/* Model Selector */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Select Models to Compare ({selectedModels.length})
              </h3>
              <span className="text-sm text-gray-600">
                Pick 2-10 models
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(modelsByProvider).map(([provider, models]) => (
                <div key={provider} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 text-sm mb-3">{provider}</h4>
                  <div className="space-y-2">
                    {models.map((model) => {
                      const metadata = getModelMetadata(model);
                      const isSelected = selectedModels.includes(model);

                      return (
                        <button
                          key={model}
                          type="button"
                          onClick={() => handleToggleModel(model)}
                          className={`w-full flex items-start gap-2 p-2 rounded-lg transition text-left ${
                            isSelected
                              ? 'bg-blue-50 border-2 border-blue-500'
                              : 'bg-gray-50 border-2 border-transparent hover:border-gray-300'
                          }`}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 truncate">
                              {metadata.name}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {metadata.description}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              ${metadata.costPer1M.input}/$
                              {metadata.costPer1M.output} per 1M tokens
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {loading && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Comparing {selectedModels.length} models in parallel...
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      This may take 30-60 seconds
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-900">Comparison failed</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-8">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {result.modelsCompared}
                </div>
                <div className="text-sm text-gray-600">Models Compared</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {result.comparison.biasMetrics.consensusScore}%
                </div>
                <div className="text-sm text-gray-600">Consensus Score</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="text-3xl font-bold text-purple-600 mb-1">
                  {result.comparison.biasMetrics.diversityScore}%
                </div>
                <div className="text-sm text-gray-600">Diversity Score</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="text-3xl font-bold text-orange-600 mb-1">
                  {result.comparison.tools.length}
                </div>
                <div className="text-sm text-gray-600">Unique Tools Found</div>
              </div>
            </div>

            {/* Consensus Bars */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Tool Recommendations by Consensus
              </h2>
              <div className="space-y-3">
                {result.visualizations.consensusBars.slice(0, 15).map((bar) => (
                  <div key={bar.toolName} className="flex items-center gap-4">
                    <div className="w-48 flex-shrink-0">
                      <p className="font-medium text-sm text-gray-900 truncate">
                        {bar.toolName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {bar.mentionCount}/{result.modelsCompared} models
                      </p>
                    </div>
                    <div className="flex-1 h-8 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full flex items-center px-3 text-xs font-medium text-white ${
                          bar.consensus === 'unanimous'
                            ? 'bg-green-500'
                            : bar.consensus === 'majority'
                            ? 'bg-blue-500'
                            : bar.consensus === 'minority'
                            ? 'bg-yellow-500'
                            : 'bg-gray-400'
                        }`}
                        style={{ width: `${bar.percentage}%` }}
                      >
                        {bar.percentage >= 20 && `${Math.round(bar.percentage)}%`}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        bar.consensus === 'unanimous'
                          ? 'bg-green-100 text-green-700'
                          : bar.consensus === 'majority'
                          ? 'bg-blue-100 text-blue-700'
                          : bar.consensus === 'minority'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {bar.consensus}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Heat Map Matrix */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-x-auto">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Heat Map: Model × Tool Matrix
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Darker colors = higher ranking • Click cells for details
              </p>
              <div className="min-w-[800px]">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left p-2 text-sm font-semibold text-gray-700">
                        Model
                      </th>
                      {result.visualizations.heatMap[0]?.recommendations.map((rec) => (
                        <th
                          key={rec.tool}
                          className="p-2 text-xs font-medium text-gray-600 min-w-[80px]"
                        >
                          <div className="transform -rotate-45 origin-left truncate">
                            {rec.tool}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.visualizations.heatMap.map((row) => (
                      <tr key={row.modelId} className="border-t border-gray-200">
                        <td className="p-2">
                          <div className="font-medium text-sm text-gray-900">
                            {row.model}
                          </div>
                          <div className="text-xs text-gray-500">{row.provider}</div>
                        </td>
                        {row.recommendations.map((rec) => (
                          <td key={rec.tool} className="p-1 text-center">
                            {rec.recommended ? (
                              <div
                                className={`w-full h-10 rounded flex items-center justify-center text-xs font-bold text-white ${
                                  rec.ranking === 1
                                    ? 'bg-green-600'
                                    : rec.ranking === 2
                                    ? 'bg-green-500'
                                    : rec.ranking === 3
                                    ? 'bg-blue-500'
                                    : 'bg-blue-400'
                                }`}
                                title={`Rank #${rec.ranking}`}
                              >
                                #{rec.ranking}
                              </div>
                            ) : (
                              <div className="w-full h-10 rounded bg-gray-100"></div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Side-by-Side Model Responses */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Side-by-Side Comparison
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {result.responses.map((response) => (
                  <div
                    key={response.model}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="mb-3">
                      <h3 className="font-semibold text-gray-900">{response.modelName}</h3>
                      <p className="text-xs text-gray-500">{response.provider}</p>
                    </div>
                    <div className="space-y-2">
                      {response.tools.map((tool, index) => (
                        <div
                          key={index}
                          className="text-sm border-l-2 border-blue-500 pl-2"
                        >
                          <p className="font-medium text-gray-900">
                            {index + 1}. {tool.name}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {tool.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Example Questions */}
        {!result && !loading && (
          <div className="mt-16">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 text-center">
              Try comparing models on:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                'Best AI meeting notes app',
                'Top sales engagement platform for enterprise',
                'Email verification service for high volume',
                'Product analytics tool for SaaS',
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
    </div>
  );
}
