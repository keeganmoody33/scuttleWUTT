# ScuttleWUTT Knowledge Base Establishment Plan

**Session Date:** April 4, 2026  
**Audit Status:** Complete (3 exploration agents)  
**Current State:** 80% feature-complete, documentation fragmented  
**Goal:** Establish canonical knowledge base with session persistence

---

## EXECUTIVE SUMMARY

ScuttleWUTT is a sophisticated multi-door SaaS platform (80-95% feature-complete) with **fragmented documentation**. The codebase is production-ready for Door A, near-ready for Doors B/C, but lacks:

1. **Canonical product documentation** (PRD, app flows, tech stack)
2. **Session persistence layer** (progress tracking between sessions)
3. **Consistent terminology** (legacy vs current features mixed)
4. **Critical operational docs** (API reference, deployment guide)

This plan establishes a **single source of truth** knowledge base following the requested structure:
- **Product**: prd.md
- **User Flows**: app-flow.md
- **Technology**: tech-stack.md
- **Code Standards**: frontend-guidelines.md, backend-structure.md
- **Execution**: implementation-plan.md
- **Session Persistence**: CLAUDE.md (updated), progress.txt (new)

---

## AUDIT FINDINGS SUMMARY

### What We Have (51 TypeScript files, 10 .md docs)

**✅ Strengths:**
- 3 working product "doors" with UIs and APIs
- 13 service files with clean abstractions
- 32 AI models across 7 providers
- Strong TypeScript + Zod validation
- Feature-specific docs (SMS, QA, Rate Limiting, Question Sandbox)
- CLAUDE.md is comprehensive for developers

**❌ Gaps:**
- No PRD or product strategy doc
- No user flow documentation
- No locked dependency versions doc
- No API reference
- No deployment guide
- No session-to-session progress tracking
- README/ARCHITECTURE.md have legacy content

**⚠️ Inconsistencies:**
- ARCHITECTURE.md focuses on deprecated product discovery scrapers
- README.md doesn't reflect three-door strategy
- Door C status unclear (80% done but docs say "pending")
- Authentication mentioned but not implemented
- Google Trends: "pending" vs "simulated" vs "working"

### Implementation Status

| Door | Completion | Missing |
|------|------------|---------|
| **Door A: Consensus Tool** | 95% ✅ | Better caching |
| **Door B: Opportunity Tracker** | 85% ⚠️ | Auth, cron jobs |
| **Door C: Brand Intel** | 80% ⚠️ | Auth, alerts, cron jobs |

**Critical Blockers for Launch:**
1. No authentication/authorization (multi-tenancy broken)
2. No automated background jobs (manual refresh only)
3. No test coverage
4. Settings page is UI-only

---

## KNOWLEDGE BASE STRUCTURE

### The Contract: Product Requirements

**File:** `prd.md`  
**Status:** ❌ Missing (create new)  
**Purpose:** Single source of truth for product vision, features, success metrics

**Contents:**
1. Product Vision & Positioning
2. Target Users & Personas
3. Three-Door Strategy (A/B/C)
4. Feature Inventory with Status
5. Success Metrics (KPIs)
6. Roadmap Phases
7. Explicitly Out of Scope
8. User Stories
9. Non-Goals

**Why Critical:** No single doc currently explains "what we're building and why"

---

### The User Journey: App Flows

**File:** `app-flow.md`  
**Status:** ❌ Missing (create new)  
**Purpose:** Every page, every navigation path, every decision point

**Contents:**
1. Door A Flow: Question → Answer → Subscribe → Verify → Timeline
2. Door B Flow: Track Idea → View Opportunity Window → Refresh → Alert
3. Door C Flow: Add Brand → Track Mentions → Sentiment Analysis → Alerts
4. Onboarding Flow: Anonymous → Email-Verified → Free Account → Pro Account
5. Decision Trees: What triggers each action?
6. Error States: What happens when things fail?
7. Mobile vs Desktop differences

**Why Critical:** New developers can't understand user paths without this

---

### The Stack: Locked Versions

**File:** `tech-stack.md`  
**Status:** ❌ Missing (create new)  
**Purpose:** Every package, dependency, API, tool with exact versions

**Contents:**
1. Framework & Runtime (Next.js 14.2.0, React 18.3.0, TypeScript 5.x)
2. Database & ORM (PostgreSQL, Drizzle 0.30.0)
3. AI/LLM Integration (32 models, 7 providers, exact SDK versions)
4. Communication (Resend 3.2.0, Twilio 5.0.0)
5. UI Framework (98.css, Tailwind 3.4.0)
6. Environment Variables (required vs optional)
7. External Services (Google Trends, Redis, etc.)
8. Dependency Matrix (what requires what)

**Why Critical:** Audit found good info scattered across multiple docs

---

### The Standards: Code Guidelines

**File:** `frontend-guidelines.md`  
**Status:** ❌ Missing (create new)  
**Purpose:** UI patterns, component structure, Windows 98 design system

**Contents:**
1. Windows 98 Design Philosophy
   - Maurice Sendak ocean aesthetic rationale
   - Hand-drawn SVG waves (not blocky patterns)
   - Color system (CSS variables)
   - 3D beveled borders
2. Component Structure
   - DraggableWindow usage
   - Win98 form patterns
   - Responsive grid system
3. State Management
   - TanStack Query patterns
   - Client vs server components
4. Styling Conventions
   - Tailwind + 98.css integration
   - When to use inline styles vs classes

**File:** `backend-structure.md`  
**Status:** ❌ Missing (create new)  
**Purpose:** Service layer architecture, API patterns, database conventions

**Contents:**
1. Service Layer Patterns
   - LLM abstraction (`callLLM()` interface)
   - Multi-model consensus algorithm
   - Rate limiting implementation
2. API Route Structure
   - Zod validation pattern
   - Error handling conventions
   - Rate limit scopes
3. Database Patterns
   - Drizzle query patterns
   - Migration workflow
   - ID generation (`generateId()`)
4. Security Patterns
   - Bearer token authentication (when implemented)
   - Input sanitization
   - SQL injection prevention

---

### The Execution: Implementation Plan

**File:** `implementation-plan.md`  
**Status:** ❌ Missing (create new)  
**Purpose:** What's built, what's next, priority order

**Contents:**
1. Current State Snapshot (Door A/B/C completion %)
2. Phase 1: Launch Readiness (authentication, testing, deployment)
3. Phase 2: Background Jobs (cron system for auto-refresh)
4. Phase 3: Enterprise Features (alerts, monitoring, analytics)
5. Phase 4: Scale & Optimize (caching, Redis, performance)
6. Technical Debt Backlog
7. Known Limitations & Workarounds

**Why Critical:** No clear "what's next" exists beyond scattered TODOs in code

---

## SESSION PERSISTENCE LAYER

### Primary: CLAUDE.md Updates

**File:** `CLAUDE.md`  
**Status:** ⚠️ Needs updates  
**Changes Required:**
1. Add "Session History" section at top
   - Last session date
   - What was completed
   - What's in progress
2. Add "Current Blockers" section
   - Authentication not implemented
   - Background jobs missing
   - Test coverage gap
3. Update "Project Overview" section
   - Remove conflicting info about legacy features
   - Clarify Door C status (80% done, not "pending")
4. Add "Decision Log" section
   - Why Windows 98 design?
   - Why multi-model over single?
   - Why GPT-4o-mini for question grading?
   - Why these pricing tiers?

### Secondary: progress.txt

**File:** `progress.txt`  
**Status:** ❌ Missing (create new)  
**Format:** Append-only log with timestamps  
**Purpose:** Quick session-to-session context

**Structure:**
```
=== Session: 2026-04-03 ===
COMPLETED:
- Question Sandbox feature (question grading with GPT-4o-mini)
- API endpoint /api/analyze-question
- Real-time UI integration in /ask page

IN PROGRESS:
- (none)

BLOCKERS:
- (none)

NEXT SESSION:
- Establish knowledge base (this plan)
- Create canonical docs (PRD, app-flow, tech-stack)

=== Session: 2026-04-04 ===
(append here when session ends)
```

**Why Critical:** Requested by user for session continuity

---

## DOCUMENT FIXES & UPDATES

### Fix README.md

**Current Issues:**
- Describes product as "curated feed" (outdated)
- Focuses on product discovery scrapers (legacy feature)
- Doesn't mention three-door strategy
- Doesn't link to PLATFORM_OVERVIEW.md (the real overview)

**Required Changes:**
1. Lead with three-door strategy (Door A/B/C)
2. Remove or de-emphasize product discovery scrapers
3. Add link to PLATFORM_OVERVIEW.md at top
4. Update quick start to reflect /ask, /alpha, /brand-intel routes
5. Add "What's Working" vs "What's Planned" section

---

### Fix ARCHITECTURE.md

**Current Issues:**
- 80% focused on legacy product discovery system
- Doesn't document three-door architecture
- Outdated deployment info
- Google Trends status unclear

**Required Changes:**
1. Add header warning: "This doc covers legacy features. See PLATFORM_OVERVIEW.md for current architecture."
2. Create new section: "Multi-Door Architecture" (Door A/B/C)
3. Update deployment section with current environment variables
4. Clarify Google Trends status (working, with caching)
5. Document authentication plan (currently not implemented)

---

### Reconcile Inconsistencies

**Terminology Standardization:**
| Inconsistent Term | Standard Term | Update In |
|-------------------|---------------|-----------|
| "Scuttle What" vs "ScuttleWUTT" | **ScuttleWUTT** | All docs |
| "Trifecta Engine" (ambiguous) | **Three-Door Strategy** (platform), **Consensus Engine** (Door A) | PLATFORM_OVERVIEW, CLAUDE.md |
| Door C "pending" vs "80% done" | **80% complete, auth/alerts pending** | All docs |
| Google Trends "pending" vs "working" | **Implemented with caching** | ARCHITECTURE, CLAUDE.md |
| Authentication "optional" vs "required" | **Not yet implemented, required for Doors B/C** | ARCHITECTURE, CLAUDE.md |

**Feature Status Clarity:**
Create feature status matrix in implementation-plan.md:
```
| Feature | Status | Blockers |
|---------|--------|----------|
| Door A: Consensus | ✅ Prod-ready | Better caching |
| Door B: Opportunity Tracker | ⚠️ 85% | Auth, cron jobs |
| Door C: Brand Intel | ⚠️ 80% | Auth, alerts, cron |
| Multi-tenancy | ❌ Missing | No auth system |
| Background Jobs | ❌ Missing | No cron/queue |
| Test Suite | ❌ Missing | Need Jest setup |
```

---

## MISSING CRITICAL DOCS

### API Reference

**File:** `API_REFERENCE.md`  
**Status:** ❌ Missing (create new)  
**Severity:** HIGH (developers must reverse-engineer from code)

**Contents:**
1. Authentication (Bearer token when implemented)
2. Rate Limiting (headers, quotas)
3. Endpoint Reference:
   - POST /api/consensus - Multi-model question answering
   - POST /api/compare - Model comparison
   - POST /api/analyze-question - Question quality grading
   - POST /api/subscribe - Subscribe to updates
   - POST /api/verify - Verify SMS/email code
   - GET/POST /api/alpha - Opportunity trackers
   - PUT/DELETE /api/alpha/[id] - Refresh/delete tracker
   - GET/POST /api/brand-trackers - Brand tracking
   - PUT/DELETE /api/brand-trackers/[id] - Refresh/delete tracker
4. Request/Response Examples (cURL)
5. Error Codes (400, 401, 429, 500)
6. Webhooks (future)

---

### Deployment Guide

**File:** `DEPLOYMENT.md`  
**Status:** ❌ Missing (create new)  
**Severity:** HIGH (blocks launch)

**Contents:**
1. Prerequisites
   - Node.js version
   - PostgreSQL setup
   - Environment variables
2. Database Setup
   - Connection string format
   - Running migrations: `npm run db:migrate`
   - Initial data seeding (if any)
3. Vercel Deployment (recommended)
   - Step-by-step instructions
   - Environment variable configuration
   - Build settings
   - Domain setup
4. Alternative Deployment (Railway, Render, etc.)
5. Post-Deployment Checklist
   - Test /api/consensus endpoint
   - Verify SMS/email sending
   - Check rate limiting
   - Monitor logs
6. Troubleshooting Common Issues
   - Database connection refused
   - API key errors
   - Rate limit exhaustion

---

## IMPLEMENTATION PHASES

### Phase 1: Documentation Foundation (This Session - 45 minutes)

**Priority:** Establish knowledge base structure

**Tasks:**
1. ✅ Audit complete (done via exploration agents)
2. Create `prd.md` - Product requirements (15 min)
3. Create `app-flow.md` - User journeys (10 min)
4. Create `tech-stack.md` - Dependency manifest (10 min)
5. Create `progress.txt` - Session tracking (2 min)
6. Update `CLAUDE.md` - Add session history (5 min)
7. Update `README.md` - Fix outdated content (3 min)

**Deliverables:**
- 5 new canonical docs
- 2 updated docs
- Session persistence layer established

---

### Phase 2: Critical Docs (Next Session - 30 minutes)

**Priority:** Add missing operational docs

**Tasks:**
1. Create `API_REFERENCE.md` - Complete endpoint docs (15 min)
2. Create `DEPLOYMENT.md` - Step-by-step deployment (10 min)
3. Create `implementation-plan.md` - Roadmap (5 min)

**Deliverables:**
- API reference for developers
- Deployment runbook
- Clear roadmap

---

### Phase 3: Guidelines & Standards (Future Session - 30 minutes)

**Priority:** Establish code conventions

**Tasks:**
1. Create `frontend-guidelines.md` - UI patterns (15 min)
2. Create `backend-structure.md` - Service layer patterns (10 min)
3. Update `ARCHITECTURE.md` - Reconcile legacy content (5 min)

**Deliverables:**
- Code standards documentation
- Architecture clarity

---

### Phase 4: Feature Completion (Future - Multiple Sessions)

**Priority:** Close implementation gaps

**Tasks:**
1. Implement authentication system (Door B/C blocker)
2. Add background job system (cron/queue)
3. Build alert notification system (Door C)
4. Add test suite (Jest/Vitest)
5. Implement Settings page functionality

**Not part of documentation work** - this is feature development

---

## DECISION POINTS FOR USER

Before proceeding, please confirm:

### 1. Documentation Structure

**Question:** Does this knowledge base structure meet your needs?
- prd.md (product requirements)
- app-flow.md (user journeys)
- tech-stack.md (dependencies)
- frontend-guidelines.md (UI patterns)
- backend-structure.md (service layer)
- implementation-plan.md (roadmap)
- progress.txt (session tracking)

**Alternative:** Would you prefer a different structure?

---

### 2. Session Persistence

**Question:** Is the two-layer approach acceptable?
- **CLAUDE.md** - Permanent project guidance (updated per major milestone)
- **progress.txt** - Append-only session log (updated every session)

**Alternative:** Would you prefer a single file or different format?

---

### 3. Priority Order

**Question:** Should I start with Phase 1 (documentation foundation)?
- Create PRD, app-flow, tech-stack first
- Then fix README/CLAUDE.md
- Then add API reference & deployment guide

**Alternative:** Would you prefer a different order?

---

### 4. Feature Status Documentation

**Question:** Should I create a feature status matrix showing:
- What's production-ready (Door A)
- What needs auth (Doors B/C)
- What needs cron jobs (auto-refresh)
- What needs testing

**Alternative:** Different format for tracking this?

---

### 5. Legacy Feature Handling

**Question:** How should we handle legacy features (product scrapers, digest generation)?
- **Option A:** Mark as "deprecated" but leave in docs
- **Option B:** Move to separate `LEGACY.md` file
- **Option C:** Remove entirely from main docs

**Recommendation:** Option A (mark deprecated, explain in README)

---

## SUCCESS CRITERIA

This plan is complete when:

**✅ Documentation:**
- [ ] PRD exists with clear product vision
- [ ] App flows documented for all 3 doors
- [ ] Tech stack locked with exact versions
- [ ] API reference with cURL examples
- [ ] Deployment guide with step-by-step instructions

**✅ Session Persistence:**
- [ ] CLAUDE.md updated with current state
- [ ] progress.txt created with session log
- [ ] No conflicting information between docs

**✅ Consistency:**
- [ ] Terminology standardized (ScuttleWUTT, not Scuttle What)
- [ ] Feature status clear (Door A: 95%, Door B: 85%, Door C: 80%)
- [ ] Legacy features clearly marked
- [ ] No ambiguous "pending" vs "working" status

**✅ Clarity:**
- [ ] New developer can understand product in 15 minutes
- [ ] New developer can deploy in 30 minutes
- [ ] Current implementation gaps clearly documented

---

## RISK ASSESSMENT

**Low Risk:**
- Creating new docs (no code changes)
- Updating existing docs (non-breaking)
- Standardizing terminology

**Medium Risk:**
- Revealing incomplete features (authentication, cron jobs)
  - **Mitigation:** Clearly document as "planned" not "broken"

**High Risk:**
- None identified (documentation-only plan)

---

## NEXT STEPS

**Immediate (waiting for your approval):**
1. Review this plan
2. Answer decision points (5 questions above)
3. Approve or request changes

**After Approval (Phase 1 execution - 45 minutes):**
1. Create prd.md
2. Create app-flow.md
3. Create tech-stack.md
4. Create progress.txt
5. Update CLAUDE.md
6. Update README.md
7. Commit all changes with descriptive message

**Session End:**
1. Update progress.txt with completed work
2. Update CLAUDE.md "Last Session" section
3. Push all documentation to repository

---

## APPENDIX: AUDIT SOURCES

This plan is based on three comprehensive exploration agents:

1. **Documentation Audit Agent** (10 files analyzed)
   - Found: Good feature docs, missing strategic docs
   - Inconsistencies: Legacy vs current architecture
   - Quality: 6.5/10 overall

2. **Tech Stack Analysis Agent** (package.json + service layer)
   - 32 AI models, 7 providers
   - Next.js 14.2, React 18, TypeScript 5
   - No technical debt identified

3. **Feature Inventory Agent** (51 TypeScript files analyzed)
   - Door A: 95% complete
   - Door B: 85% complete
   - Door C: 80% complete
   - Critical gaps: auth, cron jobs, tests

---

**Plan Author:** Claude (Sonnet 4.5)  
**Plan Date:** 2026-04-04  
**Plan Status:** AWAITING USER APPROVAL  
**Estimated Execution Time:** 45 minutes (Phase 1 only)
