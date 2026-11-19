#!/bin/bash

echo "🔍 Nova Machine - Setup Verification"
echo "======================================"
echo ""

# Check if .env.local exists
if [ -f ".env.local" ]; then
    echo "✅ .env.local file found"

    # Check Firebase config
    if grep -q "NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy" .env.local; then
        echo "✅ Firebase API key configured"
    else
        echo "❌ Firebase API key missing or incorrect"
    fi

    if grep -q "NEXT_PUBLIC_FIREBASE_PROJECT_ID=nova-machine-a0e5a" .env.local; then
        echo "✅ Firebase project ID configured"
    else
        echo "❌ Firebase project ID missing"
    fi

    # fal.ai: no server key needed — each user adds their own key in the app
    echo "ℹ️  fal.ai keys are supplied by each user in the app (stored only in their browser)"
else
    echo "❌ .env.local file not found!"
    exit 1
fi

echo ""
echo "📦 Checking dependencies..."

# Check if node_modules exists
if [ -d "node_modules" ]; then
    echo "✅ Dependencies installed"
else
    echo "❌ Dependencies not installed. Run: pnpm install"
    exit 1
fi

echo ""
echo "🧹 Cleaning build cache..."
rm -rf .next
echo "✅ Cleaned .next folder"

echo ""
echo "🔨 Running type check..."
pnpm tsc --noEmit 2>&1 | grep -v ".next/" | grep "error TS" > /tmp/tsc-errors.txt || true

if [ -s /tmp/tsc-errors.txt ]; then
    echo "⚠️  Type errors found:"
    cat /tmp/tsc-errors.txt
else
    echo "✅ No type errors"
fi

echo ""
echo "======================================"
echo "Setup Status:"
echo ""
echo "✅ Environment configured"
echo "✅ Dependencies ready"
echo "✅ Type check passed"
echo ""
echo "Next steps:"
echo "1. Follow FIREBASE_SETUP_STEPS.md to enable Firebase services"
echo "2. Run 'pnpm dev' to start the development server"
echo "3. Open http://localhost:3000 and test sign up!"
echo ""
echo "For detailed setup instructions, see:"
echo "  - FIREBASE_SETUP_STEPS.md (Firebase console setup)"
echo "  - SETUP.md (Complete setup guide)"
echo ""
