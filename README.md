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

Every prompt node picks its model per category (each option shows its fal cost for the current inputs):

| Category | Models (fal.ai) |
|----------|-----------------|
| Video | Seedance 2.5, Kling 4 (native multi-character casting), Gemini Omni Flash 1.2, Veo 3.1, Seedance 2.5 Flash |
| Image | GPT Image 2.6, Nano Banana 2.1, FLUX 3, Seedream 5.5 |
| Lip-sync (audio wired into a video prompt) | OmniHuman 2, HeyGen Avatar 6, MiniMax H3 Max Lip Sync, Sync 3 (photo or clip, picks the singer), VEED Lipsync 2 |
| Speech | ElevenLabs Eleven v4, Gemini 3.8 Flash TTS |
| Audio (dialogue + effects + ambience) | ByteDance Seed Audio 1.0, ElevenLabs SFX v3 |
| Music | Google Lyria 3.5, ElevenLabs Music 2.5, MiniMax Music 3 |
| Timeline export | FFmpeg compose / trim / stills-to-video |

**Characters** keep their identity across scenes: a four-view turnaround (three-quarter, side, back, face), an identity lock (auto-described by Claude) added to every prompt that casts them, and native `@Element` casting on Kling 4.

**Timeline**: switch the timeline icon on any prompt, video, image, audio or output node and it becomes a layer in the docked timeline (move, trim, snap, mute/solo/lock, preview, export to MP4). A prompt layer always plays its newest take, so regenerating a scene updates the edit.

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
