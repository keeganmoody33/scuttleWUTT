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

```bash
# Database
DATABASE_URL=postgresql://...

# APIs
OPENAI_API_KEY=sk-...
PRODUCTHUNT_API_KEY=...
TWITTER_BEARER_TOKEN=...
RESEND_API_KEY=re_...

# Redis (for job queue)
REDIS_URL=redis://...

# App
NEXT_PUBLIC_APP_URL=https://...
```

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

## Security Considerations

1. **API Keys**: Never commit to git, use environment variables
2. **Rate Limiting**: Implement on API routes
3. **Input Validation**: Sanitize user inputs (Zod schemas)
4. **SQL Injection**: Use ORM (Drizzle) with parameterized queries
5. **XSS**: Sanitize HTML in product descriptions
6. **CORS**: Configure for frontend domain only
