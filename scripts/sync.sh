#!/bin/bash

# Sync script for keeping the project up to date with remote repository
# Usage: ./scripts/sync.sh [fetch|pull|status|full]

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the action from command line argument, default to 'status'
ACTION=${1:-status}

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

echo -e "${GREEN}🔄 ScuttleWUTT Sync Tool${NC}"
echo -e "Current branch: ${YELLOW}${CURRENT_BRANCH}${NC}"
echo ""

case $ACTION in
  fetch)
    echo -e "${GREEN}Fetching latest changes from remote...${NC}"
    git fetch origin
    echo -e "${GREEN}✓ Fetch complete${NC}"
    echo ""
    echo "To see what changed, run: git log HEAD..origin/${CURRENT_BRANCH}"
    ;;
  
  pull)
    echo -e "${GREEN}Pulling latest changes from remote...${NC}"
    git pull origin "${CURRENT_BRANCH}"
    echo -e "${GREEN}✓ Pull complete${NC}"
    ;;
  
  status)
    echo -e "${GREEN}Checking repository status...${NC}"
    echo ""
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
      echo -e "${YELLOW}⚠ You have uncommitted changes${NC}"
      git status --short
      echo ""
    else
      echo -e "${GREEN}✓ Working directory is clean${NC}"
      echo ""
    fi
    
    # Fetch to check remote status
    echo "Checking remote status..."
    git fetch origin --quiet
    
    # Check if local is behind remote
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse "origin/${CURRENT_BRANCH}" 2>/dev/null || echo "")
    
    if [ -z "$REMOTE" ]; then
      echo -e "${YELLOW}⚠ Remote branch 'origin/${CURRENT_BRANCH}' not found${NC}"
    elif [ "$LOCAL" != "$REMOTE" ]; then
      BEHIND=$(git rev-list --count HEAD.."origin/${CURRENT_BRANCH}")
      AHEAD=$(git rev-list --count "origin/${CURRENT_BRANCH}"..HEAD)
      
      if [ "$BEHIND" -gt 0 ]; then
        echo -e "${YELLOW}⚠ Your branch is ${BEHIND} commit(s) behind origin/${CURRENT_BRANCH}${NC}"
        echo "   Run: npm run sync:pull or ./scripts/sync.sh pull"
      fi
      
      if [ "$AHEAD" -gt 0 ]; then
        echo -e "${GREEN}✓ Your branch is ${AHEAD} commit(s) ahead of origin/${CURRENT_BRANCH}${NC}"
        echo "   Consider pushing: git push origin ${CURRENT_BRANCH}"
      fi
    else
      echo -e "${GREEN}✓ Your branch is up to date with origin/${CURRENT_BRANCH}${NC}"
    fi
    ;;
  
  full)
    echo -e "${GREEN}Running full sync...${NC}"
    echo ""
    
    # First check status
    ./scripts/sync.sh status
    
    echo ""
    echo -e "${GREEN}Pulling latest changes...${NC}"
    git pull origin "${CURRENT_BRANCH}"
    
    echo ""
    echo -e "${GREEN}✓ Full sync complete${NC}"
    ;;
  
  *)
    echo -e "${RED}Unknown action: ${ACTION}${NC}"
    echo ""
    echo "Usage: ./scripts/sync.sh [fetch|pull|status|full]"
    echo ""
    echo "Actions:"
    echo "  fetch  - Fetch latest changes from remote (doesn't merge)"
    echo "  pull   - Pull and merge latest changes from remote"
    echo "  status - Check sync status (default)"
    echo "  full   - Check status and pull latest changes"
    exit 1
    ;;
esac

