# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Scuttle WUTT is a multi-door SaaS discovery platform that leverages multi-model LLM consensus to provide unbiased, trustworthy tool recommendations. The platform has evolved from a simple product aggregator into a sophisticated "Trifecta Engine" with three distinct product offerings ("doors").

**Core Value Proposition:** Cut through the noise of SaaS tools by using AI consensus across multiple LLM providers to detect bias, track market changes, and identify opportunity windows.

## Architecture: The "Multi-Door Platform"

The codebase implements three distinct products sharing a common backend infrastructure:

### Door A: Executive Consensus Tool (Lead Magnet - Free)
- **Route:** `/api/consensus`
- **Purpose:** Ask questions about SaaS tools, get vetted answers backed by multi-model consensus
- **Key Feature:** Hidden complexity (multi-model comparison) → visible value (Trust Badge with consensus score)
- **Models Used:** Claude Sonnet 4.5, GPT-4o, DeepSeek Chat (3 models for speed)
- **Service Files:** `src/services/question-answering.ts`, `src/services/model-comparison.ts`

### Door B: Scuttle Alpha (Pro Feature - Opportunity Tracker)
- **Route:** `/api/alpha`
- **Purpose:** Track startup ideas and monitor "opportunity windows" (demand vs. saturation)
- **Data Sources:**
  - Market Intent: `src/services/demand-proxy.ts` (external demand signals)
  - Market Saturation: Multi-model consensus on competitors
- **Opportunity Score:** High demand + low saturation = wide open window
- **DB Table:** `opportunity_trackers`

### Door C: Brand Intel Engine (Enterprise Feature)
- **Purpose:** Track how LLMs recommend your brand across prompts (share of voice, sentiment)
- **DB Table:** `brand_trackers`
- **Status:** Schema defined, implementation pending

## Tech Stack

- **Framework:** Next.js 14 (App Router, React Server Components)
- **Database:** PostgreSQL with Drizzle ORM
- **LLMs:** Multi-provider architecture
  - Anthropic Claude (primary)
  - OpenAI GPT-4o
  - DeepSeek Chat
  - OpenRouter (Llama, Mistral)
  - Perplexity (web search)
  - Google Gemini (coming soon)
- **Email:** Resend
- **SMS:** Twilio
- **Styling:** Tailwind CSS
- **Type Safety:** TypeScript + Zod for validation

## Key Commands

```bash
# Development
npm run dev                 # Start Next.js dev server on port 3000

# Database
npm run db:generate         # Generate Drizzle migrations from schema
npm run db:migrate          # Run migrations (uses src/db/migrate.ts)
npm run db:studio           # Open Drizzle Studio (DB GUI)

# Scrapers (Legacy product discovery feature)
npm run scrape              # Run all scrapers
npm run scrape:producthunt  # Product Hunt API scraper
npm run scrape:twitter      # Twitter/X API scraper

# Jobs
npm run digest:generate     # Generate user digests (legacy feature)

# Build
npm run build               # Production build
npm run start               # Start production server
npm run lint                # Run ESLint
```

## Critical Architecture Patterns

### 1. Multi-Model LLM Service (`src/services/llm.ts`)

The `callLLM()` function is the universal interface for all LLM providers. It routes based on model prefix:
- `claude-*` → Anthropic SDK
- `gpt-*` → OpenAI SDK
- `deepseek-*` → OpenAI-compatible API
- `llama-*`, `mistral-*` → OpenRouter
- `perplexity-*` → Perplexity API

**Always use the abstraction:**
```typescript
import { callLLM, type LLMModel } from '@/services/llm';
const response = await callLLM('claude-sonnet-4-5', systemPrompt, userMessage);
```

### 2. Model Comparison Engine (`src/services/model-comparison.ts`)

The consensus algorithm powers Door A. It:
1. Runs same question across multiple models in parallel
2. Normalizes tool names (case-insensitive matching)
3. Calculates consensus levels:
   - **Unanimous:** All models recommend this tool
   - **Majority:** >50% of models recommend it
   - **Minority:** 2+ models but <50%
   - **Unique:** Only 1 model recommends it
4. Computes bias metrics (diversity score, consensus score, provider bias)

**Usage pattern (see `/api/consensus`):**
```typescript
const responses = await Promise.all(models.map(m => answerQuestion(question, m)));
const comparison = compareModelResponses(responses);
const consensusTools = comparison.tools.filter(t =>
  t.consensus === 'unanimous' || t.consensus === 'majority'
);
```

### 3. Database Schema Evolution

The schema started with product discovery tables (`products`, `product_sources`) but evolved to support the Q&A system and multi-door platform:

**Original Tables (Legacy):**
- `products`, `product_sources`, `digests`, `scraping_jobs`
- Still functional but not primary feature

**Q&A System Tables (Door A):**
- `questions` - Stores all asked questions and latest answers
- `answer_snapshots` - Tracks how answers change over time (with `model_used` field)
- `question_subscriptions` - Email/SMS subscriptions with verification workflow

**Multi-Door Platform Tables:**
- `opportunity_trackers` - Door B (startup idea opportunity tracking)
- `brand_trackers` - Door C (enterprise brand intelligence)

### 4. Subscription & Verification Flow

The platform supports email AND SMS delivery with verification:

**Verification Process:**
1. User subscribes → generate 6-digit code → send via email/SMS
2. Code expires after 10 minutes (`verification_code_expires_at`)
3. User verifies via `/api/verify` → set `verified: true`
4. Only verified subscriptions get updates

**Files involved:**
- `/api/subscribe` - Create subscription + send verification
- `/api/verify` - Verify code
- `src/services/sms.ts` - Twilio integration

### 5. Snapshot System for Temporal Tracking

Answers change over time. The `answer_snapshots` table captures this:
- Each time a question is re-asked, create a snapshot
- Track which model generated the answer (`model_used` field)
- Users can view timelines: `/question/[id]/timeline`
- Powers "notify on change only" feature

**Service:** `src/services/snapshots.ts`

## Environment Variables

Required for full functionality:

```bash
# Database
DATABASE_URL=postgresql://...

# LLM Providers (add as many as you want)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=...
OPENROUTER_API_KEY=...
PERPLEXITY_API_KEY=...

# Communication
RESEND_API_KEY=re_...              # Email delivery
TWILIO_ACCOUNT_SID=AC...           # SMS delivery
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# Scrapers (optional - legacy feature)
PRODUCTHUNT_API_KEY=...
TWITTER_BEARER_TOKEN=...

# Infrastructure
REDIS_URL=redis://...              # BullMQ job queue (optional)
CRON_SECRET=...                    # Protect cron endpoints
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## File Structure by Feature

### Door A (Consensus Tool)
- `src/app/ask/page.tsx` - UI for asking questions
- `src/app/api/consensus/route.ts` - Multi-model consensus endpoint
- `src/app/api/ask/route.ts` - Legacy single-model endpoint
- `src/app/api/subscribe/route.ts` - Subscription management
- `src/app/api/verify/route.ts` - Verification codes
- `src/app/question/[id]/timeline/page.tsx` - Timeline view
- `src/services/question-answering.ts` - Core prompt + LLM call
- `src/services/model-comparison.ts` - Consensus algorithm
- `src/services/snapshots.ts` - Temporal tracking

### Door B (Opportunity Tracker)
- `src/app/alpha/page.tsx` - UI for tracking ideas
- `src/app/api/alpha/route.ts` - Create/list trackers
- `src/services/demand-proxy.ts` - External demand signals
- `src/services/scoring.ts` - Opportunity window calculation

### Shared Infrastructure
- `src/services/llm.ts` - Multi-provider LLM abstraction
- `src/services/sms.ts` - Twilio SMS delivery
- `src/db/schema.ts` - Complete database schema
- `src/db/index.ts` - Drizzle client instance
- `src/db/migrate.ts` - Migration runner

### Legacy Features (Product Discovery)
- `src/scrapers/` - Product Hunt & Twitter scrapers
- `src/services/digest.ts` - Email digest generation
- `src/services/llm-analysis.ts` - Product analysis with LLMs
- `src/components/ProductCard.tsx` - Product display component

## Testing

The codebase includes end-to-end test scripts:
- `test-door-a.ts` - Tests full consensus flow with real API calls
- `test-door-a-mock.ts` - Tests with mocked LLM responses
- `DOOR-A-TEST-RESULTS.md` - Test documentation and results

**To run tests:**
```bash
tsx test-door-a.ts        # Real API test
tsx test-door-a-mock.ts   # Mock test
```

## Development Workflow

### Adding a New LLM Provider

1. Add model type to `LLMModel` union in `src/services/llm.ts`
2. Create provider client (OpenAI SDK, custom HTTP client, etc.)
3. Add routing logic in `callLLM()` function
4. Add model metadata in `getModelMetadata()`
5. Update `getAvailableModels()` grouping

### Creating a New "Door" (Product Offering)

1. Add database tables to `src/db/schema.ts`
2. Run `npm run db:generate` and `npm run db:migrate`
3. Create API route in `src/app/api/[door-name]/route.ts`
4. Create frontend page in `src/app/[door-name]/page.tsx`
5. Add service layer in `src/services/[door-name].ts`
6. Use existing multi-model infrastructure (`callLLM`, `compareModelResponses`)

### Modifying the Consensus Prompt

The prompt in `src/services/question-answering.ts` (`SCUTTLE_WHAT_PROMPT`) defines how models answer questions. Key rules:
- Only tools launched in last 90 days
- Require visible traction (numbers)
- Return 3-5 tools maximum
- Be brutally honest about downsides
- Focus on B2B SaaS

**CRITICAL:** Always return strict JSON format. The parsing logic is fragile.

### Working with Subscriptions

When modifying subscription logic:
- Always respect the verification workflow
- Support both `email` and `sms` delivery methods
- Handle `notifyOnChangeOnly` flag (only send if answer changed)
- Update `nextSendAt` after sending
- Check `verified: true` before sending updates

## Common Pitfalls

1. **LLM JSON Parsing:** Models sometimes return markdown code blocks. Strip them before parsing:
   ```typescript
   let jsonText = response.content.trim();
   if (jsonText.startsWith('```json')) {
     jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
   }
   ```

2. **Model Naming Conventions:** Internal names (e.g., `claude-sonnet-4-5`) map to API names (e.g., `claude-sonnet-4-20250514`). Check the mapping in `callClaude()`.

3. **Parallel Model Calls:** Always use `Promise.all()` for multi-model queries. Wrap each call in try-catch to handle individual failures gracefully.

4. **Database ID Generation:** Use `generateId(prefix)` from `src/lib/utils.ts` for all IDs. Prefix conventions: `q` (questions), `sub` (subscriptions), `opp` (opportunity trackers).

5. **SMS Rate Limits:** Twilio has rate limits. Don't send verification codes more than once per minute to the same number.

## Documentation Files

- `README.md` - High-level product overview
- `ARCHITECTURE.md` - Original product discovery system architecture
- `QA_SYSTEM.md` - Detailed Q&A system (Door A) documentation
- `SMS_FEATURE.md` - SMS delivery implementation details
- `DOOR-A-TEST-RESULTS.md` - Test results and validation

## Philosophy: Hidden Complexity, Visible Value

The entire platform is built on this principle:
- **Hide:** Multi-model orchestration, consensus algorithms, bias detection
- **Show:** Trust Badge, consensus percentage, "3 out of 3 models agree"

Users don't need to understand how it works. They need to trust the output. The multi-model approach creates that trust.
