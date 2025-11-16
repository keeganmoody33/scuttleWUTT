/**
 * Multi-model comparison and bias tracking
 */

import type { QuestionAnswer, Tool } from './question-answering';
import type { LLMModel } from './llm';

export interface ModelResponse {
  model: LLMModel;
  answer: QuestionAnswer;
  modelName: string;
  provider: string;
}

export interface ToolComparison {
  tool: Tool;
  mentionedBy: LLMModel[];
  mentionCount: number;
  consensus: 'unanimous' | 'majority' | 'minority' | 'unique';
}

export interface ComparisonResult {
  tools: ToolComparison[];
  totalModels: number;
  overlap: {
    unanimous: Tool[]; // All models agree
    majority: Tool[]; // >50% of models
    minority: Tool[]; // 2+ models but <50%
    unique: Array<{ tool: Tool; model: LLMModel }>; // Only 1 model
  };
  vennDiagram: VennDiagramData;
  biasMetrics: BiasMetrics;
}

export interface VennDiagramData {
  sets: Array<{
    model: LLMModel;
    modelName: string;
    size: number;
    tools: Tool[];
  }>;
  intersections: Array<{
    models: LLMModel[];
    size: number;
    tools: Tool[];
  }>;
}

export interface BiasMetrics {
  diversityScore: number; // 0-100, higher = more diverse recommendations
  consensusScore: number; // 0-100, higher = more agreement
  providerBias: Array<{
    provider: string;
    uniqueTools: number;
    overlap: number;
  }>;
  modelDifferences: Array<{
    model1: LLMModel;
    model2: LLMModel;
    similarity: number; // 0-100
    uniqueToModel1: Tool[];
    uniqueToModel2: Tool[];
    shared: Tool[];
  }>;
}

/**
 * Compare responses from multiple models
 */
export function compareModelResponses(responses: ModelResponse[]): ComparisonResult {
  if (responses.length === 0) {
    throw new Error('No responses to compare');
  }

  // Build tool comparison map
  const toolMap = new Map<string, ToolComparison>();

  responses.forEach(({ model, answer, modelName }) => {
    answer.tools.forEach((tool) => {
      const key = tool.name.toLowerCase().trim();

      if (toolMap.has(key)) {
        const existing = toolMap.get(key)!;
        existing.mentionedBy.push(model);
        existing.mentionCount++;
      } else {
        toolMap.set(key, {
          tool,
          mentionedBy: [model],
          mentionCount: 1,
          consensus: 'unique',
        });
      }
    });
  });

  // Classify consensus
  const totalModels = responses.length;
  const tools: ToolComparison[] = Array.from(toolMap.values()).map((tc) => {
    const percentage = (tc.mentionCount / totalModels) * 100;

    let consensus: ToolComparison['consensus'];
    if (tc.mentionCount === totalModels) {
      consensus = 'unanimous';
    } else if (percentage > 50) {
      consensus = 'majority';
    } else if (tc.mentionCount > 1) {
      consensus = 'minority';
    } else {
      consensus = 'unique';
    }

    return { ...tc, consensus };
  });

  // Sort by mention count (most agreed upon first)
  tools.sort((a, b) => b.mentionCount - a.mentionCount);

  // Build overlap categories
  const overlap = {
    unanimous: tools.filter((t) => t.consensus === 'unanimous').map((t) => t.tool),
    majority: tools.filter((t) => t.consensus === 'majority').map((t) => t.tool),
    minority: tools.filter((t) => t.consensus === 'minority').map((t) => t.tool),
    unique: tools
      .filter((t) => t.consensus === 'unique')
      .map((t) => ({
        tool: t.tool,
        model: t.mentionedBy[0],
      })),
  };

  // Build Venn diagram data
  const vennDiagram = buildVennDiagram(responses, tools);

  // Calculate bias metrics
  const biasMetrics = calculateBiasMetrics(responses, tools);

  return {
    tools,
    totalModels,
    overlap,
    vennDiagram,
    biasMetrics,
  };
}

/**
 * Build Venn diagram data structure
 */
function buildVennDiagram(
  responses: ModelResponse[],
  tools: ToolComparison[]
): VennDiagramData {
  // Individual sets (each model's tools)
  const sets = responses.map(({ model, answer, modelName }) => ({
    model,
    modelName,
    size: answer.tools.length,
    tools: answer.tools,
  }));

  // Find all intersections (combinations of models)
  const intersections: VennDiagramData['intersections'] = [];

  // For each possible combination of models (2 or more)
  for (let size = 2; size <= responses.length; size++) {
    const combinations = getCombinations(responses, size);

    combinations.forEach((combo) => {
      const models = combo.map((r) => r.model);

      // Find tools that appear in ALL models in this combination
      const sharedTools = tools.filter((tc) => {
        return models.every((m) => tc.mentionedBy.includes(m));
      }).map((tc) => tc.tool);

      if (sharedTools.length > 0) {
        intersections.push({
          models,
          size: sharedTools.length,
          tools: sharedTools,
        });
      }
    });
  }

  return { sets, intersections };
}

/**
 * Calculate bias and diversity metrics
 */
function calculateBiasMetrics(
  responses: ModelResponse[],
  tools: ToolComparison[]
): BiasMetrics {
  const totalTools = tools.length;
  const totalModels = responses.length;

  // Diversity score: How many unique tools across all models?
  // Higher = more diverse (each model recommending different things)
  const uniqueTools = tools.filter((t) => t.consensus === 'unique').length;
  const diversityScore = Math.round((uniqueTools / totalTools) * 100);

  // Consensus score: How many tools are agreed upon?
  // Higher = more agreement (models recommending same things)
  const agreedTools = tools.filter((t) => t.consensus !== 'unique').length;
  const consensusScore = Math.round((agreedTools / totalTools) * 100);

  // Provider bias: Group by provider and see if certain providers cluster
  const providerGroups = new Map<string, ModelResponse[]>();
  responses.forEach((r) => {
    if (!providerGroups.has(r.provider)) {
      providerGroups.set(r.provider, []);
    }
    providerGroups.get(r.provider)!.push(r);
  });

  const providerBias = Array.from(providerGroups.entries()).map(([provider, models]) => {
    const providerTools = new Set<string>();
    const sharedTools = new Set<string>();

    models.forEach((m) => {
      m.answer.tools.forEach((t) => {
        const key = t.name.toLowerCase().trim();
        providerTools.add(key);

        // Check if this tool is also mentioned by other providers
        const otherProviders = responses.filter((r) => r.provider !== provider);
        const inOthers = otherProviders.some((r) =>
          r.answer.tools.some((ot) => ot.name.toLowerCase().trim() === key)
        );

        if (inOthers) {
          sharedTools.add(key);
        }
      });
    });

    return {
      provider,
      uniqueTools: providerTools.size - sharedTools.size,
      overlap: sharedTools.size,
    };
  });

  // Pairwise model differences
  const modelDifferences: BiasMetrics['modelDifferences'] = [];

  for (let i = 0; i < responses.length; i++) {
    for (let j = i + 1; j < responses.length; j++) {
      const r1 = responses[i];
      const r2 = responses[j];

      const tools1 = r1.answer.tools.map((t) => t.name.toLowerCase().trim());
      const tools2 = r2.answer.tools.map((t) => t.name.toLowerCase().trim());

      const shared = r1.answer.tools.filter((t) =>
        tools2.includes(t.name.toLowerCase().trim())
      );

      const uniqueToModel1 = r1.answer.tools.filter(
        (t) => !tools2.includes(t.name.toLowerCase().trim())
      );

      const uniqueToModel2 = r2.answer.tools.filter(
        (t) => !tools1.includes(t.name.toLowerCase().trim())
      );

      // Jaccard similarity: intersection / union
      const union = new Set([...tools1, ...tools2]).size;
      const similarity = Math.round((shared.length / union) * 100);

      modelDifferences.push({
        model1: r1.model,
        model2: r2.model,
        similarity,
        uniqueToModel1,
        uniqueToModel2,
        shared,
      });
    }
  }

  // Sort by similarity (most different first)
  modelDifferences.sort((a, b) => a.similarity - b.similarity);

  return {
    diversityScore,
    consensusScore,
    providerBias,
    modelDifferences,
  };
}

/**
 * Get all combinations of size k from array
 */
function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 1) return arr.map((item) => [item]);
  if (k === arr.length) return [arr];

  const result: T[][] = [];

  function combine(start: number, combo: T[]) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }

    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  }

  combine(0, []);
  return result;
}

/**
 * Find tools that only one model recommended (potential bias indicators)
 */
export function findOutliers(comparison: ComparisonResult): Array<{
  tool: Tool;
  model: LLMModel;
  modelName: string;
}> {
  return comparison.overlap.unique.map((u) => ({
    tool: u.tool,
    model: u.model,
    modelName: comparison.tools.find((t) => t.tool.name === u.tool.name)?.mentionedBy[0] || u.model,
  }));
}

/**
 * Get consensus recommendations (tools most models agree on)
 */
export function getConsensusRecommendations(comparison: ComparisonResult): Tool[] {
  return [...comparison.overlap.unanimous, ...comparison.overlap.majority];
}

/**
 * Format comparison as human-readable summary
 */
export function formatComparisonSummary(comparison: ComparisonResult): string {
  const { overlap, totalModels, biasMetrics } = comparison;

  const lines = [
    `Compared ${totalModels} AI models:`,
    '',
    `📊 Consensus:`,
    `  ✓ ${overlap.unanimous.length} tools recommended by ALL models`,
    `  ✓ ${overlap.majority.length} tools recommended by MOST models`,
    `  ⚡ ${overlap.minority.length} tools with some agreement`,
    `  🔍 ${overlap.unique.length} unique recommendations`,
    '',
    `🎯 Bias Metrics:`,
    `  Diversity Score: ${biasMetrics.diversityScore}% (higher = more varied)`,
    `  Consensus Score: ${biasMetrics.consensusScore}% (higher = more agreement)`,
    '',
  ];

  if (overlap.unanimous.length > 0) {
    lines.push('🏆 Universal Recommendations (all models agree):');
    overlap.unanimous.forEach((tool) => {
      lines.push(`  • ${tool.name} - ${tool.description}`);
    });
    lines.push('');
  }

  if (overlap.unique.length > 0) {
    lines.push('🔍 Unique Insights (only one model found these):');
    overlap.unique.slice(0, 5).forEach(({ tool, model }) => {
      lines.push(`  • ${tool.name} (${model}) - ${tool.description}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}
