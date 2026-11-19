#!/bin/bash

# Firestore Security Setup Verification Script
# Run this to verify all files were created correctly

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Firestore Security Rules - Installation Verification     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Function to check file exists
check_file() {
  local file=$1
  local expected_min_size=$2

  if [ -f "$file" ]; then
    local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
    if [ "$size" -gt "$expected_min_size" ]; then
      echo -e "${GREEN}✓${NC} $file ($(numfmt --to=iec-i --suffix=B $size 2>/dev/null || echo "${size}B"))"
      ((PASSED++))
      return 0
    else
      echo -e "${RED}✗${NC} $file (too small: ${size}B, expected > ${expected_min_size}B)"
      ((FAILED++))
      return 1
    fi
  else
    echo -e "${RED}✗${NC} $file (not found)"
    ((FAILED++))
    return 1
  fi
}

echo "Checking core files..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check core files (min 1KB each)
check_file "firestore.rules" 1000
check_file "firestore.indexes.json" 1000
check_file "firestore.rules.test.ts" 1000

echo ""
echo "Checking documentation files..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check documentation (min 1KB each)
check_file "FIRESTORE_README.md" 1000
check_file "FIRESTORE_SECURITY.md" 1000
check_file "SECURITY_QUICK_REFERENCE.md" 1000
check_file "FIRESTORE_DEPLOYMENT.md" 1000
check_file "FIRESTORE_RULES_SUMMARY.md" 1000

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Summary
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed!${NC} ($PASSED/$((PASSED+FAILED)))"
  echo ""
  echo "Next steps:"
  echo "1. Review firestore.rules"
  echo "2. Read FIRESTORE_README.md"
  echo "3. Deploy to staging: firebase deploy --only firestore"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Some checks failed${NC} ($FAILED/$((PASSED+FAILED)))"
  echo ""
  echo "Please ensure all files were created correctly."
  echo ""
  exit 1
fi
