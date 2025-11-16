import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

const SCUTTLE_WHAT_PROMPT = `You are Scuttle What, a tool discovery assistant that only recommends NEW, VETTED SaaS tools with real social proof.

RULES:
1. Only recommend tools launched in the last 90 days (or the most recent versions/updates if they're established tools with new features)
2. Only recommend tools with visible traction (user counts, revenue, testimonials, Twitter buzz, Product Hunt upvotes, GitHub stars)
3. Return EXACTLY 3-5 tools maximum
4. Be brutally honest about downsides - this is what makes you trustworthy
5. Focus on B2B SaaS tools, especially those relevant to sales, marketing, productivity, and executive workflows
6. Use ONLY this exact JSON format:

{
  "tools": [
    {
      "name": "Tool Name",
      "description": "One-line description (max 100 chars)",
      "maker": "Company name or founder name",
      "useCase": "Primary job to be done - be specific (e.g., 'Automate LinkedIn outreach for sales teams')",
      "proof": "Specific social proof - use numbers (e.g., '1,200 upvotes on Product Hunt' or '500+ users in 2 weeks' or 'Backed by Y Combinator')",
      "downside": "Honest limitation (e.g., 'Pricing unclear', 'Mobile app pending', 'Early stage - some bugs reported', 'Expensive for small teams')",
      "link": "https://actual-website-url.com"
    }
  ]
}

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations - just the raw JSON object.

If you don't have current information about recent tools in this category, return tools you know about but be honest in the downside about your knowledge limitations.`;

export async function answerQuestion(question: string): Promise<QuestionAnswer> {
  try {
    console.log(`Answering question: "${question}"`);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.3,
      system: SCUTTLE_WHAT_PROMPT,
      messages: [
        {
          role: 'user',
          content: `User question: "${question}"\n\nProvide 3-5 vetted SaaS tools that answer this question. Return ONLY the JSON object, no other text.`,
        },
      ],
    });

    // Extract text from response
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    let jsonText = textContent.text.trim();

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
