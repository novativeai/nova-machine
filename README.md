# Nova Machine

A node-based canvas for AI video, image and audio-to-video generation. Wire prompts, images, characters, videos and audio together and generate with the best current fal.ai models.

## Bring your own fal.ai key

Nova Machine runs on **your own fal.ai account**. Each user adds their fal.ai API key in the app (the key button in the header); fal.ai bills them directly for what they generate.

How the key is protected:

- **Stays in the browser.** The key is saved in that browser's local storage only. It is never sent to or stored on Nova Machine's servers or Firestore.
- **Sent only to fal.ai.** Generation requests and uploads go directly from the browser to fal.ai over HTTPS. No server route receives or proxies the key.
- **Never shared.** Collaborators on a shared board use their own keys.
- **Revocable.** Users can remove it in the app at any time or revoke it from [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys). A dedicated key per app is recommended.

## Models

| Use | fal.ai endpoint |
|-----|-----------------|
| Text / image / reference to video | `bytedance/seedance-2.5/us/*` |
| Audio to video (2–20 s audio) | `lightricks/ltx-2.5/audio-to-video/{pro,fast}` |
| Images, edits, characters, scenes | `openai/gpt-image-2.6/sunburst/*` |

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Auth & data | Firebase Auth, Firestore |
| Media storage | Cloudflare R2 |
| AI generation | fal.ai (user's own key) |
| AI assistant | Anthropic Claude (command bar, moodboards) |
| State | Zustand |

## Setup

```bash
pnpm install
cp .env.example .env.local   # Firebase, Resend, Anthropic, admin secret; add R2_* for media storage
pnpm dev
```

No fal.ai key is needed on the server.

Deploy the Firestore rules whenever `firestore.rules` changes:

```bash
firebase deploy --only firestore:rules
```

See [SETUP.md](SETUP.md) for Firebase details and [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md) for the canvas architecture.
