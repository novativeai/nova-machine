# Nova Machine - Complete Setup Guide

This guide will walk you through setting up Nova Machine from scratch.

## Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- Firebase account
- fal.ai account (each user brings their own API key)

---

## Step 1: Clone and Install

```bash
git clone <your-repo-url>
cd nova-machine
pnpm install
```

---

## Step 2: Firebase Setup

### 2.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: "nova-machine" (or your choice)
4. Disable Google Analytics (optional)
5. Click "Create project"

### 2.2 Enable Authentication

1. In Firebase Console, go to **Build > Authentication**
2. Click "Get started"
3. Enable **Email/Password** sign-in method
4. Enable **Google** sign-in method
   - Add your support email
   - Save

### 2.3 Create Firestore Database

1. In Firebase Console, go to **Build > Firestore Database**
2. Click "Create database"
3. Select **Start in production mode**
4. Choose location closest to your users
5. Click "Enable"

### 2.4 Set Firestore Rules

Deploy the rules in this repo (`firestore.rules`) — don't paste rules by hand:

```bash
firebase deploy --only firestore:rules
```

### 2.5 Enable Firebase Storage

1. Go to **Build > Storage**
2. Click "Get started"
3. Select **Start in production mode**
4. Click "Done"

### 2.6 Set Storage Rules

Go to **Storage > Rules** and paste:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Users can only upload to their own folders
    match /users/{userId}/{allPaths=**} {
      allow read: if true; // Public read
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Click **Publish**.

### 2.7 Get Firebase Credentials

1. Go to **Project Settings** (gear icon)
2. Scroll to "Your apps"
3. Click web icon (</>)
4. Register app name: "Nova Machine"
5. Copy the config values

---

## Step 3: fal.ai (no server key)

Nova Machine uses each user's **own fal.ai API key**. There is no fal.ai key on the server.

- Users create a key at [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys) and add it with the key button in the app header.
- The key is stored only in that user's browser and sent only to fal.ai; generations bill the user's fal.ai account.
- Each node shows the estimated fal.ai cost before generating, and outputs record what they cost.

---

## Step 4: Environment Variables

1. Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

2. Fill in the values from Step 2 (plus R2, Resend and Anthropic keys):

```bash
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=nova-machine.firebaseapp.com
# ... etc

```

---

## Step 5: Run Development Server

```bash
pnpm dev
```

Visit `http://localhost:3000`

---

## Step 6: Record Demo Videos

The landing page requires demo videos. Record these using your screen:

### Videos Needed (see `/public/videos/README.md` for full list):

1. **Hero Section** (3 videos, 15s each, 16:9, 1080p):
   - `hero-workflow.mp4` - Screen record using the canvas
   - `hero-results.mp4` - Show before/after examples
   - `hero-features.mp4` - Highlight features

2. **Feature Grid** (4 videos, 10s each):
   - `feature-nodes.mp4` - Node connections
   - `feature-ai.mp4` - AI selection
   - `feature-chain.mp4` - Chaining workflow
   - `feature-controls.mp4` - Camera/lighting

3. **Gallery** (6 videos, 5-10s, vertical 9:16):
   - Generate using fal.ai and save

### How to Record:

```bash
# 1. Record with QuickTime or OBS
# 2. Compress:
ffmpeg -i input.mp4 -c:v libx264 -crf 28 -preset slow -c:a aac -b:a 128k output.mp4

# 3. Generate poster:
ffmpeg -i video.mp4 -ss 00:00:01 -frames:v 1 poster.jpg

# 4. Place in /public/videos/
```

---

## Step 7: Test Complete Flow

### 7.1 Sign Up
1. Go to `/sign-up`
2. Create account
3. Verify you're redirected to `/dashboard`
4. Add your fal.ai API key with the key button in the header

### 7.2 Create Board
1. Click "Create New Project"
2. Add nodes, connect them
3. Check the estimated fal.ai cost on the prompt node, then generate
4. Verify the output node shows the cost and the header total updates

### 7.3 View History
1. Go to `/dashboard/history`
2. Verify your generation appears

---

## Step 8: Deploy to Production

### 8.1 Vercel Deployment (Recommended)

```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy
vercel

# Set environment variables in Vercel Dashboard
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY
# ... add all env vars from .env.local
```

### 8.2 Update URLs

After deployment:
1. Update `NEXT_PUBLIC_APP_URL` to your domain
2. Update Firebase authorized domains

---

## Troubleshooting

### "Firebase: Error (auth/network-request-failed)"
- Check Firebase API keys in `.env.local`
- Ensure Firebase Auth is enabled

### "Add your fal.ai API key" error
- Add a key with the key button in the header (it is stored in that browser only)
- Check the key is active at fal.ai/dashboard/keys

### "Videos not loading"
- Check video files are in `/public/videos/`
- Verify file names match component imports
- Use browser console to check 404 errors

---

## Next Steps

1. ✅ Record and add all demo videos
2. ✅ Customize branding (colors, logo, name)
3. ✅ Set up custom domain
5. ✅ Add analytics (Google Analytics, etc.)
6. ✅ Set up monitoring (Sentry, LogRocket)
7. ✅ Create social media assets
8. ✅ Launch! 🚀

---

## Support

For issues or questions:
- Check [Firebase Docs](https://firebase.google.com/docs)
- Check [fal.ai Docs](https://fal.ai/docs)
- Open GitHub issue

---

## Production Checklist

Before going live:

- [ ] All environment variables set in production
- [ ] Firebase Security Rules reviewed
- [ ] Firestore rules deployed (`firebase deploy --only firestore:rules`)
- [ ] All demo videos uploaded and optimized
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] Analytics installed
- [ ] Error monitoring active
- [ ] Backup strategy in place
- [ ] Terms of Service and Privacy Policy added
- [ ] Contact/support email configured

Good luck with your launch! 🎉
