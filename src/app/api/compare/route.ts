import { NextRequest, NextResponse } from 'next/server';
import { answerQuestion } from '@/services/question-answering';
import { callMultipleModels } from '@/services/llm';
import { compareModelResponses } from '@/services/model-comparison';
import type { LLMModel } from '@/services/llm';
import { getModelMetadata } from '@/services/llm';
import { z } from 'zod';
import { logger } from '@/services/logger';
import { authorizeRequest } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for multiple model calls

const CompareSchema = z.object({
  question: z.string().min(5, 'Question must be at least 5 characters'),
  models: z.array(z.string()).min(2, 'Select at least 2 models').max(10, 'Maximum 10 models'),
});

export async function POST(request: NextRequest) {
  try {
    const { authorized, reason } = authorizeRequest(request);
    if (!authorized) {
      return NextResponse.json({ error: reason || 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = enforceRateLimit(request, 'api:compare');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many comparison requests. Please slow down.' },
        { status: 429, headers: { 'Retry-After': Math.ceil(rateLimit.resetInMs / 1000).toString() } }
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = CompareSchema.parse(body);
    const { question, models } = validatedData;

    logger.info('Compare API request', { modelCount: models.length, preview: question.slice(0, 80) });

    // Call all models in parallel
    const responses = await Promise.all(
      models.map(async (model) => {
        const llmModel = model as LLMModel;
        const metadata = getModelMetadata(llmModel);

        try {
          const answer = await answerQuestion(question, llmModel);

          return {
            model: llmModel,
            answer,
            modelName: metadata.name,
            provider: metadata.provider,
            success: true,
          };
        } catch (error) {
          logger.warn('Compare API model call failed', { model, error });

          return {
            model: llmModel,
            answer: null,
            modelName: metadata.name,
            provider: metadata.provider,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    // Filter out failed responses
    const successfulResponses = responses.filter(
      (r) => r.success && r.answer
    ) as Array<{
      model: LLMModel;
      answer: any;
      modelName: string;
      provider: string;
    }>;

    if (successfulResponses.length < 2) {
      return NextResponse.json(
        {
          error: 'At least 2 models must succeed to compare',
          details: responses
            .filter((r) => !r.success)
            .map((r) => `${r.modelName}: ${(r as any).error}`),
        },
        { status: 500 }
      );
    }

    // Compare responses
    const comparison = compareModelResponses(successfulResponses);

    logger.info('Compare API completed', {
      question,
      succeeded: successfulResponses.length,
      failed: responses.length - successfulResponses.length,
    });

    // Build response with all data needed for visualizations
    return NextResponse.json({
      question,
      modelsCompared: successfulResponses.length,
      modelsFailed: responses.length - successfulResponses.length,
      responses: successfulResponses.map((r) => ({
        model: r.model,
        modelName: r.modelName,
        provider: r.provider,
        tools: r.answer.tools,
      })),
      comparison: {
        tools: comparison.tools,
        totalModels: comparison.totalModels,
        overlap: comparison.overlap,
        vennDiagram: comparison.vennDiagram,
        biasMetrics: comparison.biasMetrics,
      },
      // Additional data for visualizations
      visualizations: {
        // Heat map data: models x tools matrix
        heatMap: buildHeatMapData(successfulResponses, comparison.tools),

        // Consensus bars: tools ordered by agreement
        consensusBars: comparison.tools.map((t) => ({
          toolName: t.tool.name,
          mentionCount: t.mentionCount,
          percentage: (t.mentionCount / comparison.totalModels) * 100,
          consensus: t.consensus,
          models: t.mentionedBy,
        })),

        // Network graph data
        networkGraph: buildNetworkGraphData(successfulResponses),

        // Sankey diagram data (flow from models to tools)
        sankeyDiagram: buildSankeyData(successfulResponses, comparison),
      },
    });
  } catch (error) {
    logger.error('Compare API error', error as Error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: error.errors.map((e) => e.message).join(', '),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to compare models',
        details: 'Please try again later.',
      },
      { status: 500 }
    );
  }
}

/**
 * Build heat map data: which models recommended which tools
 */
function buildHeatMapData(responses: any[], tools: any[]) {
  const toolNames = tools.map((t) => t.tool.name);

  return responses.map((response) => ({
    model: response.modelName,
    modelId: response.model,
    provider: response.provider,
    recommendations: toolNames.map((toolName) => {
      const recommended = response.answer.tools.some(
        (t: any) => t.name.toLowerCase().trim() === toolName.toLowerCase().trim()
      );
      return {
        tool: toolName,
        recommended,
        ranking: recommended
          ? response.answer.tools.findIndex(
              (t: any) => t.name.toLowerCase().trim() === toolName.toLowerCase().trim()
            ) + 1
          : null,
      };
    }),
  }));
}

/**
 * Build network graph data (nodes = tools + models, edges = recommendations)
 */
function buildNetworkGraphData(responses: any[]) {
  const nodes: Array<{ id: string; label: string; type: 'model' | 'tool'; group: string }> = [];
  const edges: Array<{ source: string; target: string; weight: number }> = [];

  // Add model nodes
  responses.forEach((r) => {
    nodes.push({
      id: r.model,
      label: r.modelName,
      type: 'model',
      group: r.provider,
    });
  });

  // Add tool nodes and edges
  const toolSet = new Set<string>();

  responses.forEach((r) => {
    r.answer.tools.forEach((tool: any, index: number) => {
      const toolId = tool.name.toLowerCase().trim();

      if (!toolSet.has(toolId)) {
        toolSet.add(toolId);
        nodes.push({
          id: toolId,
          label: tool.name,
          type: 'tool',
          group: 'tools',
        });
      }

      // Add edge from model to tool (weight = inverse of ranking)
      edges.push({
        source: r.model,
        target: toolId,
        weight: 1 / (index + 1), // Higher weight for higher rankings
      });
    });
  });

  return { nodes, edges };
}

/**
 * Build Sankey diagram data (flow from models through consensus to tools)
 */
function buildSankeyData(responses: any[], comparison: any) {
  const nodes: Array<{ id: string; name: string }> = [];
  const links: Array<{ source: number; target: number; value: number }> = [];

  // Layer 1: Models
  responses.forEach((r) => {
    nodes.push({ id: r.model, name: r.modelName });
  });

  const modelCount = nodes.length;

  // Layer 2: Consensus categories
  const consensusCategories = ['unanimous', 'majority', 'minority', 'unique'];
  consensusCategories.forEach((cat) => {
    nodes.push({ id: cat, name: cat.charAt(0).toUpperCase() + cat.slice(1) });
  });

  // Layer 3: Top tools
  comparison.tools.slice(0, 10).forEach((t: any) => {
    nodes.push({ id: t.tool.name, name: t.tool.name });
  });

  // Links from models to consensus categories
  responses.forEach((r, rIndex) => {
    r.answer.tools.forEach((tool: any) => {
      const toolComp = comparison.tools.find(
        (t: any) => t.tool.name.toLowerCase().trim() === tool.name.toLowerCase().trim()
      );

      if (toolComp) {
        const consensusIndex = modelCount + consensusCategories.indexOf(toolComp.consensus);
        links.push({
          source: rIndex,
          target: consensusIndex,
          value: 1,
        });
      }
    });
  });

  // Links from consensus to tools
  comparison.tools.slice(0, 10).forEach((t: any, tIndex: number) => {
    const consensusIndex = modelCount + consensusCategories.indexOf(t.consensus);
    const toolIndex = modelCount + consensusCategories.length + tIndex;

    links.push({
      source: consensusIndex,
      target: toolIndex,
      value: t.mentionCount,
    });
  });

  return { nodes, links };
}
