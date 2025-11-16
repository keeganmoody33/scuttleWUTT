import { pgTable, text, timestamp, integer, boolean, jsonb, uniqueIndex, index, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const updateFrequencyEnum = pgEnum('update_frequency', ['daily', 'weekly', 'biweekly', 'on_demand']);
export const sourceTypeEnum = pgEnum('source_type', ['producthunt', 'twitter', 'hackernews', 'techcrunch', 'other']);
export const interactionTypeEnum = pgEnum('interaction_type', ['viewed', 'saved', 'dismissed', 'clicked']);

// Users table
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User preferences
export const userPreferences = pgTable('user_preferences', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  interests: jsonb('interests').$type<string[]>().notNull().default([]), // Array of interest tags
  categories: jsonb('categories').$type<string[]>().notNull().default([]), // Product categories
  updateFrequency: updateFrequencyEnum('update_frequency').default('weekly').notNull(),
  emailEnabled: boolean('email_enabled').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: uniqueIndex('user_preferences_user_id_idx').on(table.userId),
}));

// Products table
export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tagline: text('tagline'),
  description: text('description'),
  url: text('url'),
  imageUrl: text('image_url'),

  // Producer/Creator info
  producerName: text('producer_name'),
  producerUrl: text('producer_url'),

  // Launch info
  launchDate: timestamp('launch_date'),

  // Use cases (LLM extracted)
  useCases: jsonb('use_cases').$type<string[]>(),

  // Social proof metrics
  upvotes: integer('upvotes').default(0),
  comments: integer('comments').default(0),
  stars: integer('stars').default(0), // GitHub stars if applicable
  mentions: integer('mentions').default(0), // Twitter mentions

  // Downsides (LLM analyzed)
  downsides: jsonb('downsides').$type<string[]>(),

  // Categories & tags
  categories: jsonb('categories').$type<string[]>().default([]),
  tags: jsonb('tags').$type<string[]>().default([]),

  // Scoring
  qualityScore: integer('quality_score').default(0), // 0-100
  relevanceScore: integer('relevance_score').default(0), // 0-100
  recencyScore: integer('recency_score').default(0), // 0-100

  // Metadata
  processed: boolean('processed').default(false), // Has LLM analysis been done?
  featured: boolean('featured').default(false),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: index('products_name_idx').on(table.name),
  launchDateIdx: index('products_launch_date_idx').on(table.launchDate),
  qualityScoreIdx: index('products_quality_score_idx').on(table.qualityScore),
}));

// Product sources (tracking where we found each product)
export const productSources = pgTable('product_sources', {
  id: text('id').primaryKey(),
  productId: text('product_id').references(() => products.id).notNull(),
  sourceType: sourceTypeEnum('source_type').notNull(),
  sourceId: text('source_id').notNull(), // External ID (PH post ID, tweet ID, etc.)
  sourceUrl: text('source_url').notNull(),
  sourceData: jsonb('source_data'), // Raw data from source
  scrapedAt: timestamp('scraped_at').defaultNow().notNull(),
}, (table) => ({
  productIdIdx: index('product_sources_product_id_idx').on(table.productId),
  sourceIdIdx: uniqueIndex('product_sources_source_id_idx').on(table.sourceType, table.sourceId),
}));

// User product interactions
export const userProductInteractions = pgTable('user_product_interactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  productId: text('product_id').references(() => products.id).notNull(),
  interactionType: interactionTypeEnum('interaction_type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userProductIdx: index('user_product_interactions_user_product_idx').on(table.userId, table.productId),
}));

// Digests sent to users
export const digests = pgTable('digests', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  productIds: jsonb('product_ids').$type<string[]>().notNull(),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
  openedAt: timestamp('opened_at'),
}, (table) => ({
  userIdIdx: index('digests_user_id_idx').on(table.userId),
  sentAtIdx: index('digests_sent_at_idx').on(table.sentAt),
}));

// Scraping jobs tracking
export const scrapingJobs = pgTable('scraping_jobs', {
  id: text('id').primaryKey(),
  sourceType: sourceTypeEnum('source_type').notNull(),
  status: text('status').notNull(), // 'pending', 'running', 'completed', 'failed'
  productsFound: integer('products_found').default(0),
  errors: jsonb('errors').$type<string[]>(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sourceTypeIdx: index('scraping_jobs_source_type_idx').on(table.sourceType),
  statusIdx: index('scraping_jobs_status_idx').on(table.status),
}));

// ========== Q&A System Tables ==========

// Questions asked by users
export const questions = pgTable('questions', {
  id: text('id').primaryKey(),
  question: text('question').notNull(),
  askedAt: timestamp('asked_at').defaultNow().notNull(),
  // Store the answer as well
  answer: jsonb('answer').$type<{
    tools: Array<{
      name: string;
      description: string;
      maker: string;
      useCase: string;
      proof: string;
      downside: string;
      link: string;
    }>;
    generatedAt: string;
  }>(),
}, (table) => ({
  questionIdx: index('questions_question_idx').on(table.question),
  askedAtIdx: index('questions_asked_at_idx').on(table.askedAt),
}));

// Delivery method enum
export const deliveryMethodEnum = pgEnum('delivery_method', ['email', 'sms', 'both']);

// Subscriptions to questions
export const questionSubscriptions = pgTable('question_subscriptions', {
  id: text('id').primaryKey(),
  email: text('email'), // Nullable - only required if delivery method includes email
  phone: text('phone'), // Nullable - only required if delivery method includes SMS
  deliveryMethod: deliveryMethodEnum('delivery_method').notNull().default('email'),
  questionId: text('question_id').references(() => questions.id).notNull(),
  question: text('question').notNull(), // Denormalized for easier access
  frequencyDays: integer('frequency_days').notNull(), // How many days between updates
  lastSentAt: timestamp('last_sent_at'),
  nextSendAt: timestamp('next_send_at').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('question_subscriptions_email_idx').on(table.email),
  phoneIdx: index('question_subscriptions_phone_idx').on(table.phone),
  nextSendAtIdx: index('question_subscriptions_next_send_at_idx').on(table.nextSendAt),
  activeIdx: index('question_subscriptions_active_idx').on(table.active),
}));

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  preferences: one(userPreferences, {
    fields: [users.id],
    references: [userPreferences.userId],
  }),
  interactions: many(userProductInteractions),
  digests: many(digests),
}));

export const productsRelations = relations(products, ({ many }) => ({
  sources: many(productSources),
  interactions: many(userProductInteractions),
}));

export const questionsRelations = relations(questions, ({ many }) => ({
  subscriptions: many(questionSubscriptions),
}));
