# Scuttle What Q&A System

## The Core Concept

**Ask. Get vetted answers. Subscribe. Track changes over time.**

Scuttle What's Q&A system is a living intelligence tool for SaaS discovery. Users ask questions about tools they need, get instant answers from Claude, and can subscribe to those answers to track how the market changes.

## How It Works

### 1. Ask a Question
Users visit `/ask` and type any SaaS tool question:
- "Best sales engagement tool"
- "AI meeting notes app"
- "Customer feedback platform"
- etc.

### 2. Get Instant Answer
Claude (Sonnet 4.5) generates a curated response with 3-5 tools:

**For each tool:**
- Name & one-line description
- Maker/company
- Specific use case
- Social proof (with numbers)
- Honest downside
- Link

**Example:**
```
Salesloft — Multi-channel sales engagement platform
Maker: Salesloft Inc.
Use case: Automate email sequences, calls, and LinkedIn outreach for sales teams
Proof: 1,200+ upvotes on Product Hunt, used by 5,000+ companies
Downside: Expensive for small teams ($75/user/month minimum)
Link: https://salesloft.com
```

### 3. Subscribe to the Answer
After getting an answer, users can subscribe by:
- Entering their email
- Choosing update frequency (daily, every 3 days, weekly, bi-weekly, monthly)
- No login required

### 4. Get Updates When Things Change
Our cron job runs daily and:
- Re-asks the question to Claude
- Compares the new answer to the old one
- Emails subscribers when the market shifts

**Updates include:**
- New tools that entered the space
- Tools that moved up/down in ranking
- Changed social proof metrics
- Updated downsides

## The Intelligence Layer

### The Prompt (The Secret Sauce)

Located in `src/services/question-answering.ts`, the prompt tells Claude:

**Rules:**
1. Only recommend tools launched in last 90 days (or recent updates)
2. Only tools with visible traction (numbers, testimonials, buzz)
3. Return exactly 3-5 tools
4. Be brutally honest about downsides
5. Focus on B2B SaaS (sales, marketing, productivity, exec tools)
6. Use strict JSON format

**Why this works:**
- Recency filter = no stale recommendations
- Social proof requirement = no vaporware
- Honest downsides = builds trust
- Structured format = consistent, scannable answers

### Example Interaction

**User asks:** "Best sales engagement tool"

**Claude's process:**
1. Searches its knowledge (and potentially web if enabled)
2. Filters for recent tools with real traction
3. Identifies top 3-5 based on social proof
4. Extracts downsides from reviews/feedback
5. Returns structured JSON

**Result:** Instant, vetted, honest answer

## Technical Architecture

```
┌─────────────┐
│   User      │
│  /ask page  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ /api/ask    │ ─── Calls Claude API
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Claude    │ ─── Specialized prompt
│ Sonnet 4.5  │     + JSON output
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Database   │ ─── Store question + answer
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Return    │ ─── Display to user
│   Answer    │     + Show subscribe option
└─────────────┘
```

### Subscription Flow

```
┌─────────────────┐
│ User subscribes │ ─── Email + frequency
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ /api/subscribe  │ ─── Store in DB
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Daily Cron    │ ─── Runs every day
│   Job Checks    │     (Vercel Cron)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Find due        │ ─── Where next_send <= today
│ subscriptions   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Re-ask question │ ─── Call Claude again
│ to Claude       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Email update    │ ─── Resend API
│ to subscriber   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Update next_send│ ─── today + frequency
│ date in DB      │
└─────────────────┘
```

## Files & Components

### Frontend
- **`src/app/ask/page.tsx`** - Q&A interface
  - Search input
  - Answer display (Scuttle Cards)
  - Subscribe form
  - Example questions

### API Routes
- **`src/app/api/ask/route.ts`** - Handle questions
  - Validate input
  - Call Claude API
  - Store question + answer
  - Return formatted response

- **`src/app/api/subscribe/route.ts`** - Handle subscriptions
  - Validate email + frequency
  - Create/update subscription
  - Calculate next send date
  - Support unsubscribe

- **`src/app/api/cron/send-updates/route.ts`** - Automated updates
  - Find due subscriptions
  - Re-ask questions
  - Send emails
  - Update next send dates

### Services
- **`src/services/question-answering.ts`** - Claude integration
  - Main prompt
  - API call to Claude
  - JSON parsing & validation
  - HTML/text formatters for emails

### Database Schema
- **`questions`** table - All questions asked
  - id, question, answer (JSON), asked_at

- **`question_subscriptions`** table - User subscriptions
  - id, email, question_id, frequency_days
  - last_sent_at, next_send_at, active

## Setup & Configuration

### 1. Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...  # Your Claude API key
RESEND_API_KEY=re_...          # For sending emails
CRON_SECRET=random-secret      # Protect cron endpoint
```

### 2. Database Migration

```bash
npm run db:generate
npm run db:migrate
```

This creates the `questions` and `question_subscriptions` tables.

### 3. Cron Job Setup

**Option A: Vercel Cron (Recommended)**

Create `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/send-updates",
    "schedule": "0 9 * * *"
  }]
}
```

**Option B: External Cron (EasyCron, GitHub Actions)**

```bash
curl -X GET https://your-domain.com/api/cron/send-updates \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 4. Email Configuration

Scuttle What uses Resend for emails. Sign up at resend.com, verify your domain, and add your API key.

**Email template is in:** `src/services/question-answering.ts` → `formatAnswerAsHTML()`

## Usage Examples

### Basic Question
```
User: "Best sales engagement tool"
→ Returns: Salesloft, Apollo, Outreach (with proof + downsides)
```

### Niche Question
```
User: "AI tool for analyzing customer feedback"
→ Returns: Viable, Viable.ai, MonkeyLearn (recent, vetted)
```

### Subscribe to Updates
```
Email: exec@company.com
Frequency: Every 7 days
→ Gets email every week with latest answer
```

## Outreach Strategy

This Q&A system is your **wedge into executive inboxes**.

### Cold Email Template

```
Subject: Built this for you

[Name],

Made a tool that cuts SaaS discovery down to 30 seconds.

Ask it: "Best [whatever]" — returns only what's new and getting used.

[Link to /ask]

Try it. If it's useful, you can subscribe to any answer and track how the market shifts.

Worth 2 minutes if you're sick of digging through Product Hunt.
```

### Follow-Up After They Use It

```
Saw you checked out Scuttle What.

If you're tracking [category they searched], you can subscribe and get updates when the market changes. No spam, just signal.

Would love to know what you think.
```

### The Positioning

You're not selling them anything yet. You're **giving them a tool they'll actually use**.

Once they:
- Use it
- Subscribe to answers
- Come back

...you've got a real relationship to build on.

## Performance & Scaling

### API Costs

**Claude Sonnet 4.5:**
- ~$3 per 1M input tokens
- ~$15 per 1M output tokens

**Typical question:**
- Input: ~500 tokens (prompt + question)
- Output: ~800 tokens (answer with 5 tools)

**Cost per question:** ~$0.015

**With $970 in credits:** ~64,000 questions

### Email Costs

**Resend:**
- Free tier: 3,000 emails/month
- $20/month: 50,000 emails

### Database

PostgreSQL (Neon, Supabase, Railway):
- Free tier handles 10,000+ subscriptions easily
- Questions table grows slowly (only unique questions)

## Future Enhancements

### V2 Features

1. **Login & History**
   - Users can see all their questions
   - View timeline of how answers changed
   - Manage all subscriptions in one place

2. **Better Diff Display**
   - Show exactly what changed between updates
   - Highlight new tools, dropped tools, ranking shifts

3. **Category Filters**
   - "Only show AI tools"
   - "Only B2B SaaS"
   - "Only under $50/month"

4. **Team Features**
   - Share answers with team
   - Collaborative tracking
   - Team subscription plans

5. **API Access**
   - Programmatic Q&A for developers
   - Webhook notifications
   - Bulk question processing

### V3 Features

1. **Chrome Extension**
   - Ask from anywhere
   - Save answers while browsing

2. **Slack/Discord Bot**
   - `/scuttle ask [question]`
   - Daily digests in channels

3. **AI-Powered Comparisons**
   - "Compare Salesloft vs Apollo"
   - Side-by-side feature breakdown

4. **Product Launches**
   - Submit your own product
   - Get instant positioning vs competitors

## Monitoring & Debugging

### Check Subscription Status

```sql
SELECT email, question, frequency_days, next_send_at, active
FROM question_subscriptions
WHERE active = true
ORDER BY next_send_at;
```

### Test Cron Job Manually

```bash
curl -X GET https://your-domain.com/api/cron/send-updates \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Check Recent Questions

```sql
SELECT question, asked_at,
       jsonb_array_length(answer->'tools') as tool_count
FROM questions
ORDER BY asked_at DESC
LIMIT 10;
```

## Success Metrics

Track these to measure adoption:

1. **Questions asked per day**
2. **Subscription rate** (% of users who subscribe)
3. **Active subscriptions**
4. **Email open rate**
5. **Click-through rate** (emails → tool websites)
6. **Repeat usage** (users asking multiple questions)

## Summary

Scuttle What's Q&A system is a **living intelligence tool** that:

✅ Gives instant, vetted answers (no manual curation needed)
✅ Lets users subscribe to track market changes
✅ Runs 100% automated once set up
✅ Costs pennies per question
✅ Creates recurring touchpoints with users
✅ Builds trust through honest downsides

It's not a directory. It's not a newsletter. It's a **decision-making tool** that execs will actually bookmark and use.

That's your wedge.
