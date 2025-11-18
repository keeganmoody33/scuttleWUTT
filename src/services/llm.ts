/**
 * Multi-model LLM service
 * Supports ALL major LLMs for unbiased comparison and tracking
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Comprehensive model support across all major providers
export type LLMModel =
  // Anthropic Claude family
  | 'claude-sonnet-4-5'
  | 'claude-opus-4'
  | 'claude-3-5-sonnet'
  | 'claude-3-5-haiku'
  | 'claude-3-opus'
  | 'claude-3-sonnet'
  | 'claude-3-haiku'
  // OpenAI GPT family
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | 'gpt-4'
  | 'gpt-3.5-turbo'
  // DeepSeek
  | 'deepseek-chat'
  | 'deepseek-coder'
  // Google Gemini
  | 'gemini-2.0-flash'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash'
  // Meta Llama (via OpenRouter/Together)
  | 'llama-3.3-70b'
  | 'llama-3.1-405b'
  | 'llama-3.1-70b'
  // Mistral
  | 'mistral-large'
  | 'mistral-medium'
  | 'mistral-small'
  // Perplexity
  | 'perplexity-sonar-pro'
  | 'perplexity-sonar';

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ModelMetadata {
  name: string;
  provider: string;
  description: string;
  costPer1M: { input: number; output: number };
  contextWindow: number;
  supportedFeatures: string[];
}

// Initialize clients
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// DeepSeek uses OpenAI-compatible API
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseURL: 'https://api.deepseek.com/v1',
});

// OpenRouter for open source models (Llama, Mistral, etc.)
const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || '',
  baseURL: 'https://openrouter.ai/api/v1',
});

// Perplexity
const perplexity = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY || '',
  baseURL: 'https://api.perplexity.ai',
});

/**
 * Call an LLM with a system prompt and user message
 */
export async function callLLM(
  model: LLMModel,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 4000
): Promise<LLMResponse> {
  // Route to appropriate provider
  if (model.startsWith('claude')) {
    return callClaude(model, systemPrompt, userMessage, maxTokens);
  } else if (model.startsWith('gpt')) {
    return callOpenAI(model, systemPrompt, userMessage, maxTokens);
  } else if (model.startsWith('deepseek')) {
    return callDeepSeek(model, systemPrompt, userMessage, maxTokens);
  } else if (model.startsWith('gemini')) {
    return callGemini(model, systemPrompt, userMessage, maxTokens);
  } else if (model.startsWith('llama')) {
    return callOpenRouter(model, systemPrompt, userMessage, maxTokens);
  } else if (model.startsWith('mistral')) {
    return callOpenRouter(model, systemPrompt, userMessage, maxTokens);
  } else if (model.startsWith('perplexity')) {
    return callPerplexity(model, systemPrompt, userMessage, maxTokens);
  } else {
    throw new Error(`Unsupported model: ${model}`);
  }
}

/**
 * Call multiple models in parallel for comparison
 */
export async function callMultipleModels(
  models: LLMModel[],
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 4000
): Promise<Record<LLMModel, LLMResponse>> {
  const promises = models.map(async (model) => {
    try {
      const response = await callLLM(model, systemPrompt, userMessage, maxTokens);
      return { model, response };
    } catch (error) {
      console.error(`Error calling ${model}:`, error);
      return {
        model,
        response: {
          content: '',
          model,
          provider: getModelMetadata(model).provider,
          error: error instanceof Error ? error.message : 'Unknown error',
        } as LLMResponse & { error: string },
      };
    }
  });

  const results = await Promise.all(promises);

  return results.reduce(
    (acc, { model, response }) => {
      acc[model] = response;
      return acc;
    },
    {} as Record<LLMModel, LLMResponse>
  );
}

/**
 * Call Claude (Anthropic)
 */
async function callClaude(
  model: LLMModel,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<LLMResponse> {
  // Map our model names to Anthropic's API model names
  const modelMap: Record<string, string> = {
    'claude-sonnet-4-5': 'claude-sonnet-4-20250514',
    'claude-opus-4': 'claude-opus-4-20250514',
    'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku': 'claude-3-5-haiku-20241022',
    'claude-3-opus': 'claude-3-opus-20240229',
    'claude-3-sonnet': 'claude-3-sonnet-20240229',
    'claude-3-haiku': 'claude-3-haiku-20240307',
  };

  const apiModel = modelMap[model] || model;

  const response = await anthropic.messages.create({
    model: apiModel,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  return {
    content: content.text,
    model: apiModel,
    provider: 'Anthropic',
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

/**
 * Call OpenAI (GPT family)
 */
async function callOpenAI(
  model: LLMModel,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<LLMResponse> {
  const response = await openai.chat.completions.create({
    model: model,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userMessage,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  return {
    content,
    model: response.model,
    provider: 'OpenAI',
    usage: response.usage
      ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
        }
      : undefined,
  };
}

/**
 * Call DeepSeek
 */
async function callDeepSeek(
  model: LLMModel,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<LLMResponse> {
  const response = await deepseek.chat.completions.create({
    model: model,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userMessage,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content in DeepSeek response');
  }

  return {
    content,
    model: response.model,
    provider: 'DeepSeek',
    usage: response.usage
      ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
        }
      : undefined,
  };
}

/**
 * Call Google Gemini (via OpenAI-compatible API if available, or direct SDK)
 */
async function callGemini(
  model: LLMModel,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<LLMResponse> {
  // For now, we'll use a placeholder - you'd integrate the actual Gemini SDK
  // or use an OpenAI-compatible proxy
  throw new Error('Gemini integration coming soon - requires Google AI SDK');
}

/**
 * Call OpenRouter (for Llama, Mistral, and other open source models)
 */
async function callOpenRouter(
  model: LLMModel,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<LLMResponse> {
  // Map to OpenRouter model names
  const modelMap: Record<string, string> = {
    'llama-3.3-70b': 'meta-llama/llama-3.3-70b-instruct',
    'llama-3.1-405b': 'meta-llama/llama-3.1-405b-instruct',
    'llama-3.1-70b': 'meta-llama/llama-3.1-70b-instruct',
    'mistral-large': 'mistralai/mistral-large',
    'mistral-medium': 'mistralai/mistral-medium',
    'mistral-small': 'mistralai/mistral-small',
  };

  const apiModel = modelMap[model] || model;

  const response = await openrouter.chat.completions.create({
    model: apiModel,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userMessage,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content in OpenRouter response');
  }

  return {
    content,
    model: apiModel,
    provider: 'OpenRouter',
    usage: response.usage
      ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
        }
      : undefined,
  };
}

/**
 * Call Perplexity
 */
async function callPerplexity(
  model: LLMModel,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<LLMResponse> {
  const response = await perplexity.chat.completions.create({
    model: model,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userMessage,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content in Perplexity response');
  }

  return {
    content,
    model: response.model,
    provider: 'Perplexity',
    usage: response.usage
      ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
        }
      : undefined,
  };
}

/**
 * Get model metadata
 */
export function getModelMetadata(model: LLMModel): ModelMetadata {
  const metadata: Record<LLMModel, ModelMetadata> = {
    // Anthropic Claude
    'claude-sonnet-4-5': {
      name: 'Claude Sonnet 4.5',
      provider: 'Anthropic',
      description: 'Fastest and most cost-effective Claude 4 model',
      costPer1M: { input: 3, output: 15 },
      contextWindow: 200000,
      supportedFeatures: ['function-calling', 'vision', 'json-mode'],
    },
    'claude-opus-4': {
      name: 'Claude Opus 4',
      provider: 'Anthropic',
      description: 'Most capable Claude model for complex reasoning',
      costPer1M: { input: 15, output: 75 },
      contextWindow: 200000,
      supportedFeatures: ['function-calling', 'vision', 'json-mode'],
    },
    'claude-3-5-sonnet': {
      name: 'Claude 3.5 Sonnet',
      provider: 'Anthropic',
      description: 'Previous generation balanced model',
      costPer1M: { input: 3, output: 15 },
      contextWindow: 200000,
      supportedFeatures: ['function-calling', 'vision', 'json-mode'],
    },
    'claude-3-5-haiku': {
      name: 'Claude 3.5 Haiku',
      provider: 'Anthropic',
      description: 'Ultra-fast for simple tasks',
      costPer1M: { input: 0.8, output: 4 },
      contextWindow: 200000,
      supportedFeatures: ['function-calling', 'vision', 'json-mode'],
    },
    'claude-3-opus': {
      name: 'Claude 3 Opus',
      provider: 'Anthropic',
      description: 'Legacy most capable model',
      costPer1M: { input: 15, output: 75 },
      contextWindow: 200000,
      supportedFeatures: ['function-calling', 'vision', 'json-mode'],
    },
    'claude-3-sonnet': {
      name: 'Claude 3 Sonnet',
      provider: 'Anthropic',
      description: 'Legacy balanced model',
      costPer1M: { input: 3, output: 15 },
      contextWindow: 200000,
      supportedFeatures: ['function-calling', 'vision', 'json-mode'],
    },
    'claude-3-haiku': {
      name: 'Claude 3 Haiku',
      provider: 'Anthropic',
      description: 'Legacy fast model',
      costPer1M: { input: 0.25, output: 1.25 },
      contextWindow: 200000,
      supportedFeatures: ['function-calling', 'vision', 'json-mode'],
    },
    // OpenAI GPT
    'gpt-4o': {
      name: 'GPT-4o',
      provider: 'OpenAI',
      description: 'Latest flagship multimodal model',
      costPer1M: { input: 2.5, output: 10 },
      contextWindow: 128000,
      supportedFeatures: ['function-calling', 'vision', 'json-mode'],
    },
    'gpt-4o-mini': {
      name: 'GPT-4o Mini',
      provider: 'OpenAI',
      description: 'Affordable small model',
      costPer1M: { input: 0.15, output: 0.6 },
      contextWindow: 128000,
      supportedFeatures: ['function-calling', 'vision', 'json-mode'],
    },
    'gpt-4-turbo': {
      name: 'GPT-4 Turbo',
      provider: 'OpenAI',
      description: 'Previous generation flagship',
      costPer1M: { input: 10, output: 30 },
      contextWindow: 128000,
      supportedFeatures: ['function-calling', 'vision', 'json-mode'],
    },
    'gpt-4': {
      name: 'GPT-4',
      provider: 'OpenAI',
      description: 'Original GPT-4',
      costPer1M: { input: 30, output: 60 },
      contextWindow: 8192,
      supportedFeatures: ['function-calling', 'json-mode'],
    },
    'gpt-3.5-turbo': {
      name: 'GPT-3.5 Turbo',
      provider: 'OpenAI',
      description: 'Fast and cheap legacy model',
      costPer1M: { input: 0.5, output: 1.5 },
      contextWindow: 16385,
      supportedFeatures: ['function-calling', 'json-mode'],
    },
    // DeepSeek
    'deepseek-chat': {
      name: 'DeepSeek Chat',
      provider: 'DeepSeek',
      description: 'Open weights reasoning model',
      costPer1M: { input: 0.27, output: 1.10 },
      contextWindow: 64000,
      supportedFeatures: ['function-calling', 'json-mode'],
    },
    'deepseek-coder': {
      name: 'DeepSeek Coder',
      provider: 'DeepSeek',
      description: 'Specialized coding model',
      costPer1M: { input: 0.27, output: 1.10 },
      contextWindow: 64000,
      supportedFeatures: ['function-calling', 'json-mode'],
    },
    // Google Gemini
    'gemini-2.0-flash': {
      name: 'Gemini 2.0 Flash',
      provider: 'Google',
      description: 'Latest fast multimodal model',
      costPer1M: { input: 0, output: 0 }, // Free tier available
      contextWindow: 1000000,
      supportedFeatures: ['function-calling', 'vision', 'json-mode', 'grounding'],
    },
    'gemini-1.5-pro': {
      name: 'Gemini 1.5 Pro',
      provider: 'Google',
      description: 'Most capable Gemini model',
      costPer1M: { input: 1.25, output: 5 },
      contextWindow: 2000000,
      supportedFeatures: ['function-calling', 'vision', 'json-mode', 'grounding'],
    },
    'gemini-1.5-flash': {
      name: 'Gemini 1.5 Flash',
      provider: 'Google',
      description: 'Fast and efficient',
      costPer1M: { input: 0.075, output: 0.3 },
      contextWindow: 1000000,
      supportedFeatures: ['function-calling', 'vision', 'json-mode', 'grounding'],
    },
    // Meta Llama
    'llama-3.3-70b': {
      name: 'Llama 3.3 70B',
      provider: 'Meta (via OpenRouter)',
      description: 'Latest open weights model',
      costPer1M: { input: 0.59, output: 0.79 },
      contextWindow: 128000,
      supportedFeatures: ['function-calling', 'json-mode'],
    },
    'llama-3.1-405b': {
      name: 'Llama 3.1 405B',
      provider: 'Meta (via OpenRouter)',
      description: 'Largest open weights model',
      costPer1M: { input: 2, output: 2 },
      contextWindow: 128000,
      supportedFeatures: ['function-calling', 'json-mode'],
    },
    'llama-3.1-70b': {
      name: 'Llama 3.1 70B',
      provider: 'Meta (via OpenRouter)',
      description: 'Balanced open model',
      costPer1M: { input: 0.59, output: 0.79 },
      contextWindow: 128000,
      supportedFeatures: ['function-calling', 'json-mode'],
    },
    // Mistral
    'mistral-large': {
      name: 'Mistral Large',
      provider: 'Mistral AI',
      description: 'Flagship European model',
      costPer1M: { input: 2, output: 6 },
      contextWindow: 128000,
      supportedFeatures: ['function-calling', 'json-mode'],
    },
    'mistral-medium': {
      name: 'Mistral Medium',
      provider: 'Mistral AI',
      description: 'Balanced performance',
      costPer1M: { input: 2.7, output: 8.1 },
      contextWindow: 32000,
      supportedFeatures: ['function-calling', 'json-mode'],
    },
    'mistral-small': {
      name: 'Mistral Small',
      provider: 'Mistral AI',
      description: 'Fast and affordable',
      costPer1M: { input: 0.2, output: 0.6 },
      contextWindow: 32000,
      supportedFeatures: ['function-calling', 'json-mode'],
    },
    // Perplexity
    'perplexity-sonar-pro': {
      name: 'Perplexity Sonar Pro',
      provider: 'Perplexity',
      description: 'Search-augmented reasoning',
      costPer1M: { input: 3, output: 15 },
      contextWindow: 200000,
      supportedFeatures: ['web-search', 'citations'],
    },
    'perplexity-sonar': {
      name: 'Perplexity Sonar',
      provider: 'Perplexity',
      description: 'Fast search-augmented model',
      costPer1M: { input: 1, output: 1 },
      contextWindow: 128000,
      supportedFeatures: ['web-search', 'citations'],
    },
  };

  return metadata[model];
}

/**
 * Get all available models grouped by provider
 */
export function getAvailableModels(): Record<string, LLMModel[]> {
  return {
    'Anthropic Claude': [
      'claude-sonnet-4-5',
      'claude-opus-4',
      'claude-3-5-sonnet',
      'claude-3-5-haiku',
      'claude-3-opus',
      'claude-3-sonnet',
      'claude-3-haiku',
    ],
    'OpenAI GPT': ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    DeepSeek: ['deepseek-chat', 'deepseek-coder'],
    'Google Gemini': ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    'Meta Llama': ['llama-3.3-70b', 'llama-3.1-405b', 'llama-3.1-70b'],
    'Mistral AI': ['mistral-large', 'mistral-medium', 'mistral-small'],
    Perplexity: ['perplexity-sonar-pro', 'perplexity-sonar'],
  };
}

/**
 * Get recommended default models for balanced comparison
 */
export function getDefaultComparisonModels(): LLMModel[] {
  return [
    'claude-sonnet-4-5', // Anthropic's best
    'gpt-4o', // OpenAI's best
    'deepseek-chat', // Open weights alternative
    'gemini-1.5-pro', // Google's best (when available)
  ];
}

/**
 * Get all models that are available based on configured API keys
 * Useful for debugging and admin interfaces
 */
export function getAvailableModelsByKey(): {
  available: LLMModel[];
  unavailable: { model: LLMModel; reason: string }[];
  providers: Record<string, boolean>;
} {
  const available: LLMModel[] = [];
  const unavailable: { model: LLMModel; reason: string }[] = [];
  
  const providers = {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    deepseek: !!process.env.DEEPSEEK_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
    perplexity: !!process.env.PERPLEXITY_API_KEY,
    google: false, // Not yet integrated
  };

  // Anthropic models
  if (providers.anthropic) {
    available.push('claude-sonnet-4-5', 'claude-opus-4', 'claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku');
  } else {
    unavailable.push(
      { model: 'claude-sonnet-4-5', reason: 'ANTHROPIC_API_KEY not set' },
      { model: 'claude-opus-4', reason: 'ANTHROPIC_API_KEY not set' }
    );
  }

  // OpenAI models
  if (providers.openai) {
    available.push('gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo');
  } else {
    unavailable.push(
      { model: 'gpt-4o', reason: 'OPENAI_API_KEY not set' },
      { model: 'gpt-4o-mini', reason: 'OPENAI_API_KEY not set' }
    );
  }

  // DeepSeek models
  if (providers.deepseek) {
    available.push('deepseek-chat', 'deepseek-coder');
  } else {
    unavailable.push({ model: 'deepseek-chat', reason: 'DEEPSEEK_API_KEY not set' });
  }

  // OpenRouter models (Llama, Mistral)
  if (providers.openrouter) {
    available.push('llama-3.3-70b', 'llama-3.1-405b', 'llama-3.1-70b', 'mistral-large', 'mistral-medium', 'mistral-small');
  } else {
    unavailable.push(
      { model: 'llama-3.3-70b', reason: 'OPENROUTER_API_KEY not set' },
      { model: 'mistral-large', reason: 'OPENROUTER_API_KEY not set' }
    );
  }

  // Perplexity models
  if (providers.perplexity) {
    available.push('perplexity-sonar-pro', 'perplexity-sonar');
  } else {
    unavailable.push({ model: 'perplexity-sonar-pro', reason: 'PERPLEXITY_API_KEY not set' });
  }

  // Gemini models (not yet integrated)
  unavailable.push(
    { model: 'gemini-2.0-flash', reason: 'Google AI SDK not yet integrated' },
    { model: 'gemini-1.5-pro', reason: 'Google AI SDK not yet integrated' }
  );

  return { available, unavailable, providers };
}
