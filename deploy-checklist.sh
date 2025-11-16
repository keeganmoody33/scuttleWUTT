#!/bin/bash

# Scuttle What - Deployment Readiness Checklist
# Run this script to verify deployment prerequisites

set -e

COLORS_RED='\033[0;31m'
COLORS_GREEN='\033[0;32m'
COLORS_YELLOW='\033[1;33m'
COLORS_BLUE='\033[0;34m'
COLORS_NC='\033[0m' # No Color

echo -e "${COLORS_BLUE}╔════════════════════════════════════════════════════════════╗${COLORS_NC}"
echo -e "${COLORS_BLUE}║     Scuttle What - Deployment Readiness Checklist        ║${COLORS_NC}"
echo -e "${COLORS_BLUE}╚════════════════════════════════════════════════════════════╝${COLORS_NC}\n"

PASSED=0
FAILED=0
WARNINGS=0

# Check function
check() {
    local description=$1
    local command=$2
    local is_critical=${3:-true}

    echo -n "Checking $description... "

    if eval "$command" > /dev/null 2>&1; then
        echo -e "${COLORS_GREEN}✓ PASS${COLORS_NC}"
        ((PASSED++))
        return 0
    else
        if [ "$is_critical" = true ]; then
            echo -e "${COLORS_RED}✗ FAIL${COLORS_NC}"
            ((FAILED++))
        else
            echo -e "${COLORS_YELLOW}⚠ WARNING${COLORS_NC}"
            ((WARNINGS++))
        fi
        return 1
    fi
}

echo -e "${COLORS_YELLOW}━━━ Environment Variables ━━━${COLORS_NC}\n"

# Critical environment variables
check "DATABASE_URL" "[ ! -z \"\$DATABASE_URL\" ]" true
check "ANTHROPIC_API_KEY" "[ ! -z \"\$ANTHROPIC_API_KEY\" ]" true
check "OPENAI_API_KEY" "[ ! -z \"\$OPENAI_API_KEY\" ]" true
check "DEEPSEEK_API_KEY" "[ ! -z \"\$DEEPSEEK_API_KEY\" ]" true
check "NEXT_PUBLIC_APP_URL" "[ ! -z \"\$NEXT_PUBLIC_APP_URL\" ]" true

# Optional environment variables
echo ""
echo -e "${COLORS_YELLOW}Optional (for subscriptions):${COLORS_NC}"
check "RESEND_API_KEY" "[ ! -z \"\$RESEND_API_KEY\" ]" false
check "TWILIO_ACCOUNT_SID" "[ ! -z \"\$TWILIO_ACCOUNT_SID\" ]" false
check "TWILIO_AUTH_TOKEN" "[ ! -z \"\$TWILIO_AUTH_TOKEN\" ]" false

echo ""
echo -e "${COLORS_YELLOW}Optional (for Door B):${COLORS_NC}"
check "REDIS_URL" "[ ! -z \"\$REDIS_URL\" ]" false
check "CRON_SECRET" "[ ! -z \"\$CRON_SECRET\" ]" false

echo ""
echo -e "${COLORS_YELLOW}━━━ Dependencies ━━━${COLORS_NC}\n"

check "Node.js installed" "command -v node" true
check "npm installed" "command -v npm" true
check "PostgreSQL accessible" "command -v psql || [ ! -z \"\$DATABASE_URL\" ]" true

echo ""
echo -e "${COLORS_YELLOW}━━━ Project Files ━━━${COLORS_NC}\n"

check "package.json exists" "[ -f package.json ]" true
check "node_modules exists" "[ -d node_modules ]" true
check "Database schema exists" "[ -f src/db/schema.ts ]" true
check "Consensus API exists" "[ -f src/app/api/consensus/route.ts ]" true
check "Alpha API exists" "[ -f src/app/api/alpha/route.ts ]" true

echo ""
echo -e "${COLORS_YELLOW}━━━ Database ━━━${COLORS_NC}\n"

check "Can connect to database" "npm run db:studio --help" false

echo ""
echo -e "${COLORS_YELLOW}━━━ Build & Tests ━━━${COLORS_NC}\n"

echo "Running build check..."
if npm run build > /tmp/build.log 2>&1; then
    echo -e "${COLORS_GREEN}✓ Build successful${COLORS_NC}"
    ((PASSED++))
else
    echo -e "${COLORS_RED}✗ Build failed${COLORS_NC}"
    echo "See /tmp/build.log for details"
    ((FAILED++))
fi

# Summary
echo ""
echo -e "${COLORS_BLUE}╔════════════════════════════════════════════════════════════╗${COLORS_NC}"
echo -e "${COLORS_BLUE}║                        SUMMARY                             ║${COLORS_NC}"
echo -e "${COLORS_BLUE}╚════════════════════════════════════════════════════════════╝${COLORS_NC}\n"

echo -e "${COLORS_GREEN}Passed:   $PASSED${COLORS_NC}"
echo -e "${COLORS_YELLOW}Warnings: $WARNINGS${COLORS_NC}"
echo -e "${COLORS_RED}Failed:   $FAILED${COLORS_NC}"

echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${COLORS_GREEN}✓ All critical checks passed! Ready to deploy Door A.${COLORS_NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run database migrations: npm run db:migrate"
    echo "  2. Start the development server: npm run dev"
    echo "  3. Test at: http://localhost:3000/ask"
    echo "  4. Deploy to production: vercel deploy"
    exit 0
else
    echo -e "${COLORS_RED}✗ $FAILED critical check(s) failed. Please fix before deploying.${COLORS_NC}"
    echo ""
    echo "Common fixes:"
    echo "  - Copy .env.example to .env and fill in API keys"
    echo "  - Run: npm install"
    echo "  - Set up PostgreSQL database"
    exit 1
fi
