import { callLLM, type LLMModel } from './llm';
import { logger } from '@/services/logger';

export interface Tool {
  name: string;
  description: string;
  maker: string;
  useCase: string;
  proof: string;
  downside: string;
  link: string;
}

export interface QuestionAnswer {
  tools?: Tool[];
  factualAnswer?: string;
  answerType: 'tools' | 'factual';
  generatedAt: string;
}

const QUESTION_TYPE_PROMPT = `You are a question classifier. Determine if the user's question is asking for:
1. TOOL_RECOMMENDATION - They want SaaS tools, software products, or services to solve a problem
2. FACTUAL_ANSWER - They want factual information, data, names, dates, statistics, etc.

Examples of TOOL_RECOMMENDATION:
- "Best CRM for small teams"
- "AI meeting notes app"
- "Project management tool"

Examples of FACTUAL_ANSWER:
- "Who was the #1 wide receiver in the NFL draft?"
- "What is the capital of France?"
- "How many users does Slack have?"

Return ONLY a JSON object with this exact format:
{
  "type": "TOOL_RECOMMENDATION" or "FACTUAL_ANSWER"
}`;

const SCUTTLE_WHAT_PROMPT = `You are Scuttle WUTT, a consensus-driven research assistant specialized in recommending SaaS tools and software products.

RULES:
1. Focus ONLY on SaaS tools, software products, or related services that can solve the user's problem
2. Prioritize RECENT tools - focus on products launched or updated within the last 90 days
3. Return EXACTLY 3-5 tool recommendations maximum
4. Be brutally honest about limitations, downsides, and uncertainties
5. Only recommend tools with visible traction or proof (upvotes, users, reviews, etc.)
6. Use ONLY this exact JSON format:

{
  "tools": [
    {
      "name": "Tool/product name",
      "description": "One-line description of what this tool does (max 100 chars)",
      "maker": "Company or creator name (e.g., 'Acme Inc.' or 'John Doe')",
      "useCase": "Primary use case or when to use this tool (e.g., 'Project management for remote teams' or 'AI-powered code review')",
      "proof": "Evidence of traction or verification (e.g., '1,200 Product Hunt upvotes' or '5,000+ active users' or 'Featured on Hacker News')",
      "downside": "Limitation or caveat (e.g., 'Early stage product' or 'Limited integration options' or 'Higher pricing tier')",
      "link": "https://tool-website.com"
    }
  ]
}

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations - just the raw JSON object.`;

const FACTUAL_ANSWER_PROMPT = `You are Scuttle WUTT, a research assistant that provides accurate, factual answers to questions.

RULES:
1. Provide a direct, factual answer to the question
2. Be concise but complete
3. If you're uncertain, say so
4. Cite sources or provide context when relevant
5. Return ONLY a JSON object with this exact format:

{
  "answer": "Your factual answer here"
}

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations - just the raw JSON object.`;

/**
 * Determine if a question is asking for tools or factual information
 */
async function detectQuestionType(
  question: string,
  model: LLMModel
): Promise<'tools' | 'factual'> {
  try {
    const response = await callLLM(model, QUESTION_TYPE_PROMPT, `Question: "${question}"`, 1024);
    
    let jsonText = response.content.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonText);
    return parsed.type === 'FACTUAL_ANSWER' ? 'factual' : 'tools';
  } catch (error) {
    logger.warn('Failed to detect question type, defaulting to tools', { error });
    // Default to tools if detection fails
    return 'tools';
  }
}

export async function answerQuestion(
  question: string,
  model: LLMModel = 'claude-sonnet-4-5'
): Promise<QuestionAnswer> {
  const trimmedQuestion = question.trim();
  try {
    logger.info('Answering question', { model, preview: trimmedQuestion.slice(0, 80) });

    // Step 1: Detect question type
    const answerType = await detectQuestionType(trimmedQuestion, model);
    logger.info('Detected question type', { answerType });

    if (answerType === 'factual') {
      // Handle factual questions
      const userMessage = `Question: "${trimmedQuestion}"\n\nProvide a direct, factual answer. Return ONLY the JSON object, no other text.`;
      const response = await callLLM(model, FACTUAL_ANSWER_PROMPT, userMessage, 2048);

      let jsonText = response.content.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonText);

      if (!parsed.answer || typeof parsed.answer !== 'string') {
        throw new Error('Invalid response format: missing answer string');
      }

      logger.info('Generated factual answer', { model });

      return {
        factualAnswer: parsed.answer,
        answerType: 'factual',
        generatedAt: new Date().toISOString(),
      };
    } else {
      // Handle tool recommendation questions
      const userMessage = `User question: "${trimmedQuestion}"\n\nProvide 3-5 accurate, recent tool recommendations that address this question. Focus on SaaS tools and software products with real traction. Return ONLY the JSON object, no other text.`;

      const response = await callLLM(model, SCUTTLE_WHAT_PROMPT, userMessage, 4096);

      let jsonText = response.content.trim();

      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
      }

      // Parse JSON
      const parsed = JSON.parse(jsonText);

      if (!parsed.tools || !Array.isArray(parsed.tools)) {
        throw new Error('Invalid response format: missing tools array');
      }

      // Validate each tool has required fields
      for (const tool of parsed.tools) {
        if (
          !tool.name ||
          !tool.description ||
          !tool.maker ||
          !tool.useCase ||
          !tool.proof ||
          !tool.downside ||
          !tool.link
        ) {
          throw new Error(`Invalid tool format: ${JSON.stringify(tool)}`);
        }
      }

      logger.info('Generated tool recommendations', {
        model,
        toolCount: parsed.tools.length,
      });

      return {
        tools: parsed.tools,
        answerType: 'tools',
        generatedAt: new Date().toISOString(),
      };
    }
  } catch (error) {
    logger.error('Error answering question', error as Error, { model });
    throw new Error('Failed to generate answer');
  }
}

// Helper to format answer as plain text (for emails)
export function formatAnswerAsText(answer: QuestionAnswer, question: string): string {
  const lines = [
    `Question: ${question}`,
    `Updated: ${new Date(answer.generatedAt).toLocaleDateString()}`,
    '',
    '---',
    '',
  ];

  if (answer.answerType === 'factual' && answer.factualAnswer) {
    lines.push(answer.factualAnswer);
  } else if (answer.tools) {
    answer.tools.forEach((tool, index) => {
      lines.push(`${index + 1}. ${tool.name} — ${tool.description}`);
      lines.push(`   Maker: ${tool.maker}`);
      lines.push(`   Use case: ${tool.useCase}`);
      lines.push(`   Proof: ${tool.proof}`);
      lines.push(`   Downside: ${tool.downside}`);
      lines.push(`   Link: ${tool.link}`);
      lines.push('');
    });
  }

  return lines.join('\n');
}

// Helper to format answer as HTML (for emails)
export function formatAnswerAsHTML(answer: QuestionAnswer, question: string): string {
  let content = '';
  
  if (answer.answerType === 'factual' && answer.factualAnswer) {
    content = `
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin-bottom: 16px; background: white;">
        <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #1f2937;">${answer.factualAnswer.replace(/\n/g, '<br>')}</p>
      </div>
    `;
  } else if (answer.tools) {
    content = answer.tools
      .map(
        (tool, index) => `
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: white;">
        <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">
          ${index + 1}. <a href="${tool.link}" style="color: #1f2937; text-decoration: none;">${tool.name}</a>
        </h3>
        <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px;">${tool.description}</p>

        <div style="margin-bottom: 8px; font-size: 13px;">
          <strong style="color: #374151;">Maker:</strong> <span style="color: #6b7280;">${tool.maker}</span>
        </div>

        <div style="margin-bottom: 8px; font-size: 13px;">
          <strong style="color: #374151;">Use case:</strong> <span style="color: #4b5563;">${tool.useCase}</span>
        </div>

        <div style="margin-bottom: 8px; font-size: 13px;">
          <strong style="color: #10b981;">Proof:</strong> <span style="color: #059669;">${tool.proof}</span>
        </div>

        <div style="margin-bottom: 8px; font-size: 13px;">
          <strong style="color: #f59e0b;">Downside:</strong> <span style="color: #d97706;">${tool.downside}</span>
        </div>

        <div style="margin-top: 12px;">
          <a href="${tool.link}" style="color: #3b82f6; font-size: 13px; text-decoration: none;">→ Visit website</a>
        </div>
      </div>
    `
      )
      .join('');
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 24px;">
        <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #111827;">
          Scuttle What Update
        </h1>
        <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 14px;">
          <strong>Question:</strong> ${question}
        </p>
        <p style="margin: 0 0 24px 0; color: #9ca3af; font-size: 12px;">
          Updated: ${new Date(answer.generatedAt).toLocaleDateString()}
        </p>

        ${content}

        <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>Powered by Scuttle What - Cut through the noise</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
