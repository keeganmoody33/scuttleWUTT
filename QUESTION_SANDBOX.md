# Question Sandbox: Pre-Flight Quality Analysis

## Overview

The Question Sandbox is a cost-saving and user education feature that analyzes questions **before** querying expensive AI models. Think of it as "spell check" for questions, but instead of fixing typos, it optimizes for consensus quality.

## Why It Exists

### 1. **Cost Savings**
- Querying 3+ AI models costs ~$0.03 per question
- Bad questions (too vague, factual, personal) waste API costs
- By warning users before querying, we save money on questions that won't produce valuable consensus
- Example: If 20% of questions are poor quality and we prevent half of them, we save ~$300/month at 10,000 questions/month

### 2. **User Education**
- Teaches users how to ask better questions
- Shows real-time feedback on question quality
- Provides actionable suggestions for improvement
- Builds user understanding of what makes a good consensus-trackable question

### 3. **Data Moat**
- Tracks which question patterns work best
- Learns temporal value indicators
- Identifies high-consensus categories
- Builds proprietary dataset of question quality signals

### 4. **Answer Quality**
- Better questions → better consensus
- Specific questions → more useful comparisons
- Temporal questions → valuable tracking over time

## How It Works

### User Experience

1. **User types a question** (e.g., "Best CRM for small sales teams")
2. **Debounced analysis** (800ms delay while typing)
3. **Quality score appears** (0-10 scale with grade: excellent/good/fair/poor)
4. **Feedback shown**:
   - **Strengths**: What's good about this question
   - **Issues**: What could be improved
   - **Suggestions**: How to make it better
5. **Action decision**:
   - Score ≥ 7: Green light → "Proceed with Query" button
   - Score 5-6: Yellow light → Allow query but show suggestions
   - Score < 5: Red light → Warning to improve question first

### Technical Implementation

```typescript
// Service Layer (src/services/question-grader.ts)
export async function analyzeQuestion(question: string): Promise<QuestionAnalysis> {
  // Uses GPT-4o-mini for fast, cheap analysis (~$0.0001 per question)
  const response = await callLLM('gpt-4o-mini', GRADING_PROMPT, question);

  return {
    score: 0-10,
    grade: 'excellent' | 'good' | 'fair' | 'poor',
    issues: [...],
    strengths: [...],
    suggestions: [...],
    category: 'saas' | 'sports' | 'finance' | 'tech' | 'general' | 'factual' | 'personal',
    temporalValue: 'high' | 'medium' | 'low' | 'none',
    consensusLikelihood: 'high' | 'medium' | 'low',
    estimatedCost: number, // Cost to query all available models
    reasoning: string
  };
}
```

```typescript
// API Endpoint (src/app/api/analyze-question/route.ts)
POST /api/analyze-question
{
  "question": "Best CRM for small sales teams"
}

→ Returns QuestionAnalysis object
→ Rate limited (prevents abuse)
→ Public endpoint (no auth required)
```

```typescript
// Frontend Integration (src/app/ask/page.tsx)
- Debounced useEffect hook (800ms)
- Real-time analysis as user types
- Windows 98 styled feedback panel
- Hide/show toggle for power users
```

## Grading Criteria

### Good Questions Have:

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

### Bad Questions:

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

## Scoring Scale

| Score | Grade | Meaning | Action |
|-------|-------|---------|--------|
| 9-10 | Excellent | Perfect for consensus tracking | ✅ Proceed immediately |
| 7-8 | Good | Will work well, minor improvements possible | ✅ Proceed with confidence |
| 5-6 | Fair | Usable but needs refinement | ⚠️ Proceed with suggestions |
| 3-4 | Poor | Significant issues, unlikely to give valuable consensus | ❌ Improve before querying |
| 0-2 | Very Poor | Won't work, needs complete rework | ❌ Don't query, rewrite |

## Example Analysis

**Question:** "Best CRM for small sales teams"

**Analysis:**
```json
{
  "score": 8,
  "grade": "good",
  "issues": [],
  "strengths": [
    "Specific target audience (small sales teams)",
    "Clear category (CRM)",
    "Likely to have diverse opinions across models",
    "Tools in this space change frequently (temporal value)"
  ],
  "suggestions": [
    "Could add industry context (e.g., 'for SaaS startups')",
    "Consider budget constraints (e.g., 'under $100/user/month')"
  ],
  "category": "saas",
  "temporalValue": "high",
  "consensusLikelihood": "high",
  "estimatedCost": 0.009,
  "reasoning": "Well-scoped question with clear target audience and high temporal value. Minor improvements could add more context."
}
```

## Cost Analysis

### Per Question:
- **Analysis cost**: $0.0001 (GPT-4o-mini)
- **Full consensus cost**: $0.009-0.03 (depending on models available)
- **Ratio**: Analysis costs 0.3-1% of full query

### ROI Calculation:
```
Scenario: 1,000 questions/month, 20% are poor quality

Without Sandbox:
- All 1,000 questions queried
- Cost: 1,000 × $0.03 = $30/month

With Sandbox:
- 1,000 questions analyzed: 1,000 × $0.0001 = $0.10
- 200 poor questions (20%) warned
- 100 improved before querying (50% education success)
- 100 skipped entirely (50% abandon)
- 900 questions queried: 900 × $0.03 = $27
- Total: $27.10/month

Savings: $2.90/month (9.7% reduction)

At 10,000 questions/month: $29/month savings
At 100,000 questions/month: $290/month savings
```

## Future Enhancements

### 1. Interactive Question Builder
- Dropdown for category selection
- Guided wizard for specificity
- Template library for common question types

### 2. Historical Performance
- Show success rate of similar questions
- Display average consensus score for this question type
- Link to similar high-performing questions

### 3. A/B Testing Suggestions
- Generate 2-3 variations of the question
- Show predicted quality scores for each
- Let user pick the best version

### 4. Learning from Data
- Track correlation between predicted score and actual consensus
- Improve grading prompt based on real results
- Build dataset of high-quality questions for training

### 5. Premium Features
- Advanced analysis for Pro users
- Custom grading criteria for enterprises
- API access for programmatic quality checks

## Integration Points

### Current:
- `/ask` page (Door A) - Real-time analysis as user types

### Potential:
- `/alpha` page (Door B) - Analyze opportunity tracker queries
- API clients - Offer analysis endpoint for external users
- Browser extension - Analyze questions before submitting to any AI
- Documentation - Show examples of high vs low quality questions

## Monitoring

Track these metrics to measure success:

1. **Adoption Rate**: % of users who see sandbox feedback
2. **Improvement Rate**: % of users who improve question after seeing suggestions
3. **Prevention Rate**: % of poor questions prevented (score < 5)
4. **Cost Savings**: Total API costs saved by preventing bad queries
5. **Quality Improvement**: Average score of questions over time (should increase)

## Technical Notes

- **Rate Limiting**: Public endpoint, same limits as /api/consensus
- **Model**: GPT-4o-mini (fastest, cheapest, good enough for grading)
- **Fallback**: If grading fails, show neutral score (5/10) and allow query
- **Privacy**: Questions are analyzed but not stored (only passed to API)
- **Performance**: 800ms debounce prevents excessive API calls while typing

## Documentation

See also:
- `src/services/question-grader.ts` - Core implementation
- `src/app/api/analyze-question/route.ts` - API endpoint
- `src/app/ask/page.tsx` - UI integration (lines 115-118, 138-174, 427-616)

---

**Built by:** Claude Code (Anthropic)
**Status:** ✅ Production Ready
**Cost per analysis:** ~$0.0001
**Debounce delay:** 800ms
**Minimum question length:** 10 characters
