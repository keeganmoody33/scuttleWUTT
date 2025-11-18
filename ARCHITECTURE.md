# Scuttle What - Architecture Documentation

## Overview

Scuttle What is a product discovery platform that aggregates, analyzes, and curates recently launched products from multiple sources (Product Hunt, Twitter, etc.) and delivers personalized digests to users.

## System Architecture

### Data Flow

```
┌─────────────────┐
│   Data Sources  │
│  (PH, Twitter)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Scrapers     │ ─── Scheduled Jobs (Cron/BullMQ)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │
│   (Raw Data)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LLM Analysis   │ ─── OpenAI GPT-4
│  (Use Cases,    │
│   Downsides)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Product Scoring  │
│  & Ranking      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Digest Generator │ ─── User Preferences
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Email Delivery  │ ─── Resend
└─────────────────┘
         │
         ▼
┌─────────────────┐
│   End Users     │
└─────────────────┘
```

## Components

### 1. Scrapers (`src/scrapers/`)

**Purpose**: Fetch new product launches from various sources

**Scrapers**:
- `producthunt.ts` - Product Hunt GraphQL API
- `twitter.ts` - Twitter API v2 (search recent tweets)

**Output**: Raw product data stored in `products` and `product_sources` tables

**Frequency**: Run daily via cron job

### 2. LLM Analysis (`src/services/llm-analysis.ts`)

**Purpose**: Extract structured insights from raw product data

**Uses**: OpenAI GPT-4o-mini with structured JSON output

**Extracted Data**:
- **Use Cases**: 3-5 specific problems the product solves
- **Downsides**: 2-4 honest limitations or areas for improvement
- **Categories**: Broad product categories
- **Tags**: Specific keywords

**Process**:
1. Query unprocessed products
2. Send to LLM with structured prompt
3. Parse and validate JSON response
4. Update product record with analysis

### 3. Product Scoring (`src/services/scoring.ts`)

**Purpose**: Rank products by quality and relevance

**Scoring Factors**:

1. **Recency Score (40%)**: How recently was it launched?
   - 0 days ago = 100
   - 7 days ago = 50
   - 30+ days ago = 10
   - Exponential decay

2. **Social Proof Score (40%)**: Engagement metrics
   - Upvotes, comments, mentions, stars
   - Weighted combination
   - Normalized to 0-100 scale

3. **Quality Score (20%)**: Content completeness
   - Has description, image, producer info
   - Has LLM-processed analysis
   - Has sufficient use cases and downsides

**Output**: `qualityScore`, `recencyScore`, `relevanceScore` fields

### 4. Digest Generator (`src/services/digest.ts`)

**Purpose**: Create personalized product recommendations for users

**Personalization**:
1. Get user preferences (interests, categories)
2. Get products user hasn't seen (exclude recent digests)
3. Calculate relevance score:
   - Match product tags with user interests
   - Match product categories with user categories
4. Combine with quality scores
5. Return top 22 products

**Digest Scheduling**:
- Daily: Send every day
- Weekly: Send once per week
- Bi-weekly: Send every 14 days
- On-demand: Manual only

**Email Template**:
- Product name, image, tagline
- Producer info
- Use cases (bulleted list)
- Downsides (bulleted list)
- Social proof metrics

### 5. Database Schema (`src/db/schema.ts`)

**Core Tables**:

```sql
users
  - id, email, name
  - created_at, updated_at

user_preferences
  - user_id (FK)
  - interests (jsonb array)
  - categories (jsonb array)
  - update_frequency (enum)
  - email_enabled (boolean)

products
  - id, name, tagline, description
  - url, image_url
  - producer_name, producer_url
  - launch_date
  - upvotes, comments, stars, mentions
  - use_cases (jsonb array)
  - downsides (jsonb array)
  - categories, tags (jsonb arrays)
  - quality_score, recency_score, relevance_score
  - processed (boolean)

product_sources
  - product_id (FK)
  - source_type (enum: producthunt, twitter, etc.)
  - source_id (external ID)
  - source_url
  - source_data (jsonb)
  - scraped_at

digests
  - user_id (FK)
  - product_ids (jsonb array)
  - sent_at
  - opened_at

scraping_jobs
  - source_type
  - status (pending, running, completed, failed)
  - products_found
  - errors
  - started_at, completed_at
```

### 6. Frontend (`src/app/`)

**Pages**:
- `/` - Homepage with top products
- `/settings` - User preferences (email, interests, frequency)
- `/browse` - Browse all products (TODO)

**Components**:
- `ProductCard` - Display product with all info
- `Header` - Navigation

**Styling**: Tailwind CSS with custom design system

## Deployment Checklist

### Environment Variables

**Required:**
```bash
# Database
DATABASE_URL=postgresql://...
```

**Recommended for Production:**
```bash
# Security
API_ACCESS_TOKEN=your-secure-random-token     # Protect API routes
CRON_SECRET=your-cron-secret                  # Protect cron endpoints

# LLM Providers (at least one required for consensus)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Communication (for subscriptions/notifications)
RESEND_API_KEY=re_...                         # Email delivery
TWILIO_ACCOUNT_SID=AC...                      # SMS delivery (optional)
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# Rate Limiting (optional, has defaults)
RATE_LIMIT_WINDOW_MS=60000                    # 1 minute
RATE_LIMIT_MAX_REQUESTS=60                    # 60 req/min

# External Data (optional)
GOOGLE_TRENDS_DISABLED=false                  # Set true to disable
```

**Optional (Legacy Features):**
```bash
# Scrapers
PRODUCTHUNT_API_KEY=...
TWITTER_BEARER_TOKEN=...

# Job Queue
REDIS_URL=redis://...
```

**See `.env.example` for complete documentation with inline comments.**

### Jobs to Schedule

1. **Daily Scraper**: `npm run scrape` - Run at 9am UTC
2. **LLM Analysis**: Runs automatically after scraping
3. **Product Scoring**: Runs automatically after analysis
4. **Digest Generation**: `npm run digest:generate` - Run based on user frequency

### Recommended Infrastructure

- **Hosting**: Vercel (Next.js)
- **Database**: Neon, Supabase, or Railway (PostgreSQL)
- **Redis**: Upstash
- **Cron Jobs**: Vercel Cron or GitHub Actions
- **Email**: Resend

## Future Enhancements

1. **Authentication**: Clerk or NextAuth.js
2. **More Sources**:
   - Hacker News
   - TechCrunch
   - GitHub Trending
   - Reddit (r/SideProject, r/InternetIsBeautiful)
3. **Better Personalization**:
   - User feedback loop (upvote/downvote)
   - Collaborative filtering
   - ML-based recommendations
4. **Advanced Features**:
   - Chrome extension
   - Slack/Discord bot
   - API for developers
   - Product comparison
   - Price tracking
5. **Monetization**:
   - Premium tier with more digests
   - Sponsored product placements
   - Affiliate links

## Development Workflow

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Fill in API keys

# Generate database migrations
npm run db:generate

# Run migrations
npm run db:migrate

# Start dev server
npm run dev

# Run scrapers (one-time)
npm run scrape

# Generate digests (one-time)
npm run digest:generate
```

## Testing Strategy

1. **Unit Tests**: Test scoring algorithms, LLM parsing
2. **Integration Tests**: Test scrapers with mock API responses
3. **E2E Tests**: Test full flow from scraping to digest generation
4. **Manual Testing**: Verify email templates, UI/UX

## Performance Considerations

1. **Scraping**: Rate limit API calls, use exponential backoff
2. **LLM Analysis**: Batch process, use cheaper models (gpt-4o-mini)
3. **Database**: Index frequently queried fields (quality_score, launch_date)
4. **Caching**: Cache top products for homepage
5. **Email**: Batch send, use email service provider's queue

## Security & Infrastructure

### Authentication & Authorization

**API Access Control** (`src/lib/auth.ts`):
- Bearer token authentication via `API_ACCESS_TOKEN` environment variable
- Applied to all API routes uniformly
- Optional enforcement (unset = allow all, useful for development)
- **Production requirement**: Always set `API_ACCESS_TOKEN` in production

**Implementation:**
```typescript
const { authorized, reason } = authorizeRequest(request);
if (!authorized) {
  return NextResponse.json({ error: reason }, { status: 401 });
}
```

### Rate Limiting

**Per-IP Rate Limiting** (`src/lib/rate-limit.ts`):
- In-memory sliding window counters
- Default: 60 requests/minute per IP per endpoint
- Scoped buckets prevent cross-endpoint interference
- Automatic cleanup of expired entries (every 5 minutes)
- Returns HTTP 429 with `Retry-After` header when exceeded

**Configuration:**
```bash
RATE_LIMIT_WINDOW_MS=60000       # 1 minute window
RATE_LIMIT_MAX_REQUESTS=60       # 60 req/min
```

**Implementation:**
```typescript
const rateLimit = enforceRateLimit(request, 'api:consensus');
if (!rateLimit.allowed) {
  return NextResponse.json(
    { error: 'Too many requests. Please try later.' },
    { status: 429, headers: { 'Retry-After': Math.ceil(rateLimit.resetInMs / 1000) } }
  );
}
```

**Scaling Note:** Current in-memory implementation works for single-instance deployments. For horizontal scaling, migrate to Redis-backed rate limiting (see `RATE_LIMITING.md`).

### Structured Logging

**Logger Service** (`src/services/logger.ts`):
- Centralized logging with ISO timestamps and JSON context
- Log levels: debug, info, warn, error
- Environment-aware (debug in dev, info in prod)
- Proper error serialization with stack traces

**Usage:**
```typescript
logger.info('Processing consensus request', { preview: question.slice(0, 80) });
logger.error('Consensus API error', error);
```

### Environment Configuration

**Type-Safe Config** (`src/lib/env.ts`):
- Zod schema validation at startup
- Fails fast with clear error messages
- Default values for optional settings
- Prevents runtime configuration errors

**Validated Variables:**
- Database connections (required)
- LLM API keys (optional, validated per provider)
- Communication services (optional)
- Security tokens (optional but recommended for production)
- Rate limiting (with defaults)

### Error Handling

**User-Facing Error Messages:**
- Sensitive details stripped from API responses
- Generic messages: "Please try again later" instead of raw error text
- Detailed logging internally for debugging
- Proper HTTP status codes (401, 429, 500)

**Example:**
```typescript
// Internal logging (detailed)
logger.error('Error creating tracker', error);

// User response (sanitized)
return NextResponse.json(
  { error: 'Failed to create tracker', details: 'Please try again later.' },
  { status: 500 }
);
```

### Market Intelligence - Demand Proxy

**Google Trends Integration** (`src/services/demand-proxy.ts`):

The demand proxy service provides **market intent signals** by integrating with Google Trends API to measure search volume as a proxy for market demand.

**Features:**
- Real Google Trends data with 1-hour cache (prevents quota exhaustion)
- Deterministic fallback when Google Trends unavailable or disabled
- Configurable via `GOOGLE_TRENDS_DISABLED` environment variable
- Trend detection (rising/falling/flat) based on velocity
- Normalized intent score (0-100)

**Data Structure:**
```typescript
interface DemandSignal {
  keywords: string[];
  intentScore: number;        // 0-100, normalized search volume
  trend: 'rising' | 'falling' | 'flat';
  velocity: number;           // % change over time
  source: 'google_trends' | 'deterministic';
  lastUpdated: Date;
  rawData?: { searchVolume, historicalData };
}
```

**Behavior:**
1. **Google Trends Enabled** (default):
   - Fetches real search volume from Google Trends
   - Calculates trend based on 90-day moving average
   - Caches results for 1 hour per keyword set
   - Falls back to deterministic on API failure

2. **Google Trends Disabled** (`GOOGLE_TRENDS_DISABLED=true`):
   - Uses deterministic hash-based algorithm
   - Generates reproducible scores from keyword strings
   - No external API calls (useful for testing, rate-limited environments)
   - Intent score: 30-85 range based on keyword hash
   - Trend: flat (deterministic mode has no time-series data)

**Configuration:**
```bash
# Disable Google Trends (use deterministic fallback)
GOOGLE_TRENDS_DISABLED=true
```

**Use Cases:**
- **Opportunity Tracker (Door B)**: Measure demand for startup ideas
- **Consensus Tool (Door A)**: Context for market research questions
- **Brand Tracking (Door C)**: Track search interest in brands over time

**Cost Control:**
- Google Trends API is free but rate-limited
- 1-hour cache reduces API calls by ~99%
- Graceful degradation ensures service continuity

### Security Considerations

1. **API Keys**: Never commit to git, use environment variables
2. **Rate Limiting**: ✅ Implemented on all API routes (see `RATE_LIMITING.md`)
3. **Authentication**: ✅ Bearer token auth for production (optional in dev)
4. **Input Validation**: Sanitize user inputs (Zod schemas)
5. **SQL Injection**: Use ORM (Drizzle) with parameterized queries
6. **XSS**: Sanitize HTML in product descriptions
7. **CORS**: Configure for frontend domain only
8. **Error Messages**: ✅ Sanitized to prevent information disclosure
9. **Logging**: ✅ Structured logs with sensitive data redaction
