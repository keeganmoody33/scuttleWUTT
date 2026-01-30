/**
 * Question Quality Grader
 *
 * Analyzes questions before querying expensive AI models to:
 * 1. Save API costs (don't waste $0.09 on bad questions)
 * 2. Educate users (teach them how to ask better questions)
 * 3. Improve answer quality (better questions → better consensus)
 * 4. Build data moat (learn which question patterns work)
 */

import { callLLM } from './llm';

export interface QuestionAnalysis {
  score: number; // 0-10
  grade: 'excellent' | 'good' | 'fair' | 'poor';
  issues: string[];
  strengths: string[];
  suggestions: string[];
  category: 'saas' | 'sports' | 'finance' | 'tech' | 'general' | 'factual' | 'personal';
  temporalValue: 'high' | 'medium' | 'low' | 'none';
  consensusLikelihood: 'high' | 'medium' | 'low';
  estimatedCost: number; // API cost estimate
  reasoning: string; // Why we gave this score
}

const GRADING_PROMPT = `You are a question quality analyzer for ScuttleWUTT, a platform that tracks AI consensus over time.

Your job: Analyze questions and predict if they're suitable for multi-model consensus tracking.

## Good Questions Have:
1. **Temporal Value** - Answer changes over time
   - "Who will win the Super Bowl?" ✓ (changes weekly)
   - "Best CRM for small teams?" ✓ (new tools launch)
   - "Is inflation rising?" ✓ (economic conditions shift)

2. **Multiple Perspectives** - Different AI models will disagree
   - "React vs Vue?" ✓ (models have opinions)
   - "Salesforce vs HubSpot?" ✓ (different use cases)
   - "Best programming language?" ✓ (depends on context)

3. **Specificity** - Not too broad, not too narrow
   - "Best CRM for real estate agents" ✓ (just right)
   - "What's the best software?" ✗ (too broad)
   - "Does HubSpot have dark mode?" ✗ (too narrow, factual lookup)

4. **Tracking Value** - Worth monitoring over time
   - Market opportunities (which tools are emerging?)
   - Investment decisions (consensus shifting?)
   - Tool comparisons (which one is winning?)

## Bad Questions:
1. **Factual** - Static answer that never changes
   - "What is the capital of France?" ✗
   - "When was the iPhone released?" ✗
   - "How many states in the US?" ✗

2. **Too Personal** - Can't get consensus on individual situations
   - "Should I quit my job?" ✗
   - "What should I do with my life?" ✗
   - "Am I making the right choice?" ✗

3. **Too Vague** - No clear category or answer
   - "What's the best thing?" ✗
   - "Who is the greatest?" ✗
   - "What should I know?" ✗

4. **Yes/No without nuance** - Binary answer, no tracking value
   - "Is Python good?" ✗ (too simple)
   - "Is React better than Vue?" ✗ (better: "React vs Vue for...")

## Scoring:
- 9-10: Excellent - Perfect for consensus tracking
- 7-8: Good - Will work well, minor improvements possible
- 5-6: Fair - Usable but needs refinement
- 3-4: Poor - Significant issues, unlikely to give valuable consensus
- 0-2: Very Poor - Won't work, needs complete rework

## Your Output:
Return ONLY valid JSON (no markdown, no code blocks):
{
  "score": 0-10,
  "grade": "excellent" | "good" | "fair" | "poor",
  "issues": ["issue 1", "issue 2"],
  "strengths": ["strength 1", "strength 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "category": "saas" | "sports" | "finance" | "tech" | "general" | "factual" | "personal",
  "temporalValue": "high" | "medium" | "low" | "none",
  "consensusLikelihood": "high" | "medium" | "low",
  "reasoning": "1-2 sentence explanation of the score"
}`;

/**
 * Analyze a question's quality and suitability for consensus tracking
 */
export async function analyzeQuestion(
  question: string
): Promise<QuestionAnalysis> {
  console.log(`[Question Grader] Analyzing: "${question.slice(0, 80)}..."`);

  // Use GPT-4o-mini for fast, cheap analysis (~$0.0001 per question)
  const response = await callLLM(
    'gpt-4o-mini',
    GRADING_PROMPT,
    `Analyze this question: "${question}"`
  );

  // Parse JSON response
  let analysisData;
  try {
    // Strip markdown code blocks if present
    let jsonText = response.content.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
    }

    analysisData = JSON.parse(jsonText);
  } catch (error) {
    console.error('[Question Grader] Failed to parse response:', response.content);

    // Fallback: Return a neutral analysis
    return {
      score: 5,
      grade: 'fair',
      issues: ['Unable to analyze question automatically'],
      strengths: [],
      suggestions: ['Try rephrasing your question'],
      category: 'general',
      temporalValue: 'medium',
      consensusLikelihood: 'medium',
      estimatedCost: estimateAPIcost(),
      reasoning: 'Analysis failed, returned neutral score',
    };
  }

  // Estimate API cost based on available models
  const estimatedCost = estimateAPIcost();

  const analysis: QuestionAnalysis = {
    ...analysisData,
    estimatedCost,
  };

  console.log(`[Question Grader] Score: ${analysis.score}/10 (${analysis.grade})`);

  return analysis;
}

/**
 * Estimate the cost of querying all available models
 */
function estimateAPIcost(): number {
  // Count available models based on API keys
  let modelCount = 0;

  if (process.env.ANTHROPIC_API_KEY) modelCount += 7; // Claude models
  if (process.env.OPENAI_API_KEY) modelCount += 5; // GPT models
  if (process.env.DEEPSEEK_API_KEY) modelCount += 2; // DeepSeek models
  if (process.env.OPENROUTER_API_KEY) modelCount += 6; // Llama + Mistral
  if (process.env.PERPLEXITY_API_KEY) modelCount += 2; // Perplexity

  // Average cost per model: ~$0.003
  // This is a rough estimate (some models cheaper, some more expensive)
  return modelCount * 0.003;
}

/**
 * Quick validation: Is this question suitable for consensus?
 * Returns true if score >= 5
 */
export async function isQuestionSuitable(question: string): Promise<boolean> {
  const analysis = await analyzeQuestion(question);
  return analysis.score >= 5;
}

/**
 * Get improvement suggestions for a question
 */
export async function getQuestionSuggestions(
  question: string
): Promise<{
  original: string;
  improved: string[];
  reasoning: string;
}> {
  const analysis = await analyzeQuestion(question);

  return {
    original: question,
    improved: analysis.suggestions,
    reasoning: analysis.reasoning,
  };
}
