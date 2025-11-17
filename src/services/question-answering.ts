import { callLLM, type LLMModel } from './llm';

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
  tools: Tool[];
  generatedAt: string;
}

const SCUTTLE_WHAT_PROMPT = `You are Scuttle WUTT, a consensus-driven research assistant that provides the most recent, timeline-grounded answers to any question.

RULES:
1. Prioritize RECENT information - focus on what's current and up-to-date
2. Provide VERIFIED information with sources/proof where possible
3. Return EXACTLY 3-5 items/answers maximum
4. Be brutally honest about limitations or uncertainties
5. For tool/software questions: focus on new, vetted options with real traction
6. For factual/timeline questions: provide recent, verified information with sources
7. Use ONLY this exact JSON format:

{
  "tools": [
    {
      "name": "Main answer/item name",
      "description": "One-line description (max 100 chars)",
      "maker": "Source/authority (e.g., 'Reported by CNN' or 'Company XYZ' or 'Confirmed by AP News')",
      "useCase": "Context or relevance (e.g., 'December 2024' or 'Latest version released Q4 2024' or 'Primary use case')",
      "proof": "Verification/evidence (e.g., 'Multiple news sources' or '1,200 Product Hunt upvotes' or 'Official announcement')",
      "downside": "Limitation or caveat (e.g., 'Information as of Dec 2024' or 'Early stage product' or 'Limited to US sources')",
      "link": "https://source-url.com or https://relevant-link.com"
    }
  ]
}

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations - just the raw JSON object.

Adapt the format to the question type - for tools, follow tool conventions; for facts/events, adapt fields accordingly while maintaining the JSON structure.`;

export async function answerQuestion(
  question: string,
  model: LLMModel = 'claude-sonnet-4-5'
): Promise<QuestionAnswer> {
  try {
    console.log(`Answering question with ${model}: "${question}"`);

    const userMessage = `User question: "${question}"\n\nProvide 3-5 accurate, recent answers/items that address this question. Use current information. Return ONLY the JSON object, no other text.`;

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

    console.log(`✓ Generated answer with ${parsed.tools.length} tools`);

    return {
      tools: parsed.tools,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error answering question:', error);
    throw new Error(`Failed to generate answer: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  answer.tools.forEach((tool, index) => {
    lines.push(`${index + 1}. ${tool.name} — ${tool.description}`);
    lines.push(`   Maker: ${tool.maker}`);
    lines.push(`   Use case: ${tool.useCase}`);
    lines.push(`   Proof: ${tool.proof}`);
    lines.push(`   Downside: ${tool.downside}`);
    lines.push(`   Link: ${tool.link}`);
    lines.push('');
  });

  return lines.join('\n');
}

// Helper to format answer as HTML (for emails)
export function formatAnswerAsHTML(answer: QuestionAnswer, question: string): string {
  const toolCards = answer.tools
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

        ${toolCards}

        <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>Powered by Scuttle What - Cut through the noise</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
