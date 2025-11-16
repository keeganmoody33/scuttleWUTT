# Scuttle What

> Your curated feed of the most promising tools and products brought to market

## 🎯 Concept

Scuttle What is a product discovery platform that cuts through the noise. Users set their interests and update frequency, and we deliver vetted, recently launched tools with everything you need to know:

- **Tool Name & Producer**
- **Use Cases** - What problems does it solve?
- **Social Proof** - Real adoption metrics
- **Downsides** - Honest limitations and drawbacks
- **Launch Date** - How recent is it?

## 🏗️ Architecture

### Tech Stack

- **Frontend**: Next.js 14 (React + TypeScript)
- **Backend**: Next.js API Routes + Node.js
- **Database**: PostgreSQL (structured data)
- **Scraping**: Multi-source ingestion pipeline
  - Product Hunt API
  - Twitter/X API
  - Hacker News
  - Tech blogs & news sites
- **AI/LLM**: Product analysis, summarization, sentiment analysis
- **Job Queue**: Bull/BullMQ for scheduled scraping and digest generation
- **Email**: Resend or SendGrid for digest delivery

### Data Model

#### Users
- Preferences (interests, categories)
- Update frequency (daily, weekly, on-demand)
- Notification channels (email, in-app)

#### Products
- Metadata (name, producer, launch date)
- Description & use cases
- Social metrics (upvotes, stars, mentions)
- Sentiment analysis
- Downsides/limitations
- Source links

#### Sources
- Platform (Product Hunt, Twitter, etc.)
- Scraping frequency
- Last scraped timestamp

#### User Product Interactions
- Saved/bookmarked
- Dismissed
- Clicked through

### Core Features

1. **Multi-Source Scraping**
   - Automated daily scraping from multiple platforms
   - Deduplication across sources
   - Source credibility scoring

2. **Product Vetting Algorithm**
   - Recency score (newer = higher)
   - Social proof score (upvotes, stars, mentions)
   - Relevance to user interests
   - Quality signals (team, backing, traction)

3. **Smart Summarization**
   - LLM-powered extraction of use cases
   - Sentiment analysis for downsides
   - Competitive positioning

4. **Personalized Digests**
   - Customized to user preferences
   - Respectful of update frequency
   - Top ~20-25 products per digest

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run database migrations
npm run db:migrate

# Start development server
npm run dev

# Run scrapers
npm run scrape
```

## 📊 Roadmap

- [ ] Core platform setup
- [ ] Database schema & migrations
- [ ] User authentication & preferences
- [ ] Product Hunt scraper
- [ ] Twitter/X scraper
- [ ] Product vetting algorithm
- [ ] Digest generation system
- [ ] Email delivery
- [ ] Web UI for browsing products
- [ ] User feedback loop (upvote/downvote)

## 🔮 Future Ideas

- Chrome extension for instant product discovery
- Slack/Discord integrations
- API for developers
- Affiliate partnerships
- Premium tier with deeper insights
