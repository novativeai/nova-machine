# NovaMachine - AI Video Generator

## Project Overview

NovaMachine is a node-based infinite canvas AI Video Generator powered by the KLing O1 suite of models via fal.ai. It provides an intuitive visual workflow for creating, editing, and chaining AI-generated videos.

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [KLing O1 API Reference](#kling-o1-api-reference)
3. [Tag System](#tag-system)
4. [Node Types](#node-types)
5. [System Architecture](#system-architecture)
6. [Data Pipeline](#data-pipeline)
7. [Technology Stack](#technology-stack)
8. [UI/UX Specifications](#uiux-specifications)

---

## Core Concepts

### Dynamic Model Switching

The system automatically selects the appropriate KLing model based on what is connected to the prompt node:

| Connected Inputs | Model Used | Endpoint |
|-----------------|------------|----------|
| Image(s) only | Image-to-Video | `/o1/image-to-video` |
| Image(s) + Elements | Reference-to-Video | `/o1/reference-to-video` |
| Video only | Video-to-Video Reference | `/o1/video-to-video/reference` |
| Video + Edit instructions | Video-to-Video Edit | `/o1/video-to-video/edit` |
| Video + Elements | Video-to-Video Reference | `/o1/video-to-video/reference` |

### Visual Tag System

Tags in the prompt (@Image1, @Element1, @Video1) create visual connections to corresponding nodes with color-coded highlighting for easy identification.

---

## KLing O1 API Reference

### 1. Image-to-Video

**Endpoint:** `fal-ai/kling-video/o1/image-to-video`

**Purpose:** Generate videos by animating transitions between start and end frames with text guidance.

**Pricing:** $0.112/second

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | - | Video description (max 2500 chars) |
| `start_image_url` | string | Yes | - | Initial frame URL |
| `end_image_url` | string | Yes | - | Final frame URL |
| `duration` | "5" \| "10" | No | "5" | Video duration in seconds |
| `aspect_ratio` | "16:9" \| "9:16" \| "1:1" | No | "16:9" | Output aspect ratio |
| `negative_prompt` | string | No | "blur, distort, and low quality" | Content to exclude |
| `cfg_scale` | number (0-1) | No | 0.5 | Prompt adherence strength |

**Response:**
```json
{
  "video": {
    "file_size": 1234567,
    "file_name": "output.mp4",
    "content_type": "video/mp4",
    "url": "https://v3b.fal.media/files/..."
  }
}
```

---

### 2. Reference-to-Video

**Endpoint:** `fal-ai/kling-video/o1/reference-to-video`

**Purpose:** Generate videos with stable character identity and object details using reference images and elements.

**Pricing:** $0.112/second

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | - | Video description with @Image/@Element tags |
| `image_urls` | string[] | No | - | Reference images (use as @Image1, @Image2) |
| `elements` | Element[] | No | - | Character/object definitions |
| `duration` | "5" \| "10" | No | "5" | Video duration |
| `aspect_ratio` | "16:9" \| "9:16" \| "1:1" | No | "16:9" | Output aspect ratio |

**Element Structure:**
```typescript
interface Element {
  frontal_image_url: string;      // Main appearance reference
  reference_image_urls?: string[]; // Additional pose/style references
}
```

**Prompt Example:**
```
"@Element1 walks through a forest, keep it as the style of @Image2"
```

---

### 3. Video-to-Video Edit

**Endpoint:** `fal-ai/kling-video/o1/video-to-video/edit`

**Purpose:** Edit existing videos using natural language while preserving original motion structure.

**Pricing:** $0.168/second

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | - | Edit instructions (max 2500 chars) |
| `video_url` | string | Yes | - | Source video (mp4, mov, webm, m4v, gif) |
| `image_urls` | string[] | No | - | Style/appearance reference images |
| `elements` | Element[] | No | - | Character/object replacements |

**Capabilities:**
- Replace characters while maintaining movements
- Transform landscapes and environments
- Modify visual style and aesthetics
- Preserve camera angles and motion structure

---

### 4. Video-to-Video Reference

**Endpoint:** `fal-ai/kling-video/o1/video-to-video/reference`

**Purpose:** Generate new shots guided by reference video, preserving cinematic language.

**Pricing:** $0.168/second

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | - | Instructions with @Video1 reference |
| `video_url` | string | Yes | - | Reference video |
| `image_urls` | string[] | No | - | Additional style references |
| `elements` | Element[] | No | - | Character/object definitions |
| `duration` | "5" \| "10" | No | "5" | Output duration |
| `aspect_ratio` | "16:9" \| "9:16" \| "1:1" | No | "16:9" | Output aspect ratio |

**Prompt Example:**
```
"Based on @Video1, generate the next shot. Keep the style of the video"
```

---

## Tag System

### Available Tags

| Tag | Color | Description | Node Border Color |
|-----|-------|-------------|-------------------|
| `@Image1`, `@Image2`, ... | Blue (#3B82F6) | Reference images for style/composition | Blue glow |
| `@Element1`, `@Element2`, ... | Red (#EF4444) | Character/object definitions | Red glow |
| `@Video1` | Purple (#8B5CF6) | Reference video for motion/style | Purple glow |

### Tag Highlighting Behavior

1. When user types `@` in prompt, show autocomplete with available connected nodes
2. Upon tag selection, apply matching color to:
   - Tag text in prompt (colored badge)
   - Corresponding node border (animated glow)
   - Connection edge between prompt and node
3. Visual feedback helps users verify correct connections

### Tag Detection Regex

```typescript
const TAG_PATTERNS = {
  image: /@Image(\d+)/g,
  element: /@Element(\d+)/g,
  video: /@Video(\d+)/g
};
```

---

## Node Types

### 1. Prompt Node (Central Hub)

**Purpose:** Core node containing the text prompt and generation controls.

**Handles:**
- Left: Multiple target handles for inputs (images, videos, elements)
- Right: Single source handle for output video

**Properties:**
```typescript
interface PromptNodeData {
  prompt: string;
  duration: '5' | '10';
  aspectRatio: '16:9' | '9:16' | '1:1';
  negativePrompt?: string;
  cfgScale: number;
  status: 'idle' | 'generating' | 'completed' | 'error';
  progress?: number;
}
```

---

### 2. Image Node

**Purpose:** Holds reference images for generation.

**Handles:**
- Right: Source handle to connect to Prompt node

**Properties:**
```typescript
interface ImageNodeData {
  imageUrl: string;
  thumbnail: string;
  fileName: string;
  role: 'reference' | 'start_frame' | 'end_frame';
  tagAssignment?: string; // e.g., "@Image1"
}
```

---

### 3. Element Node

**Purpose:** Defines character/object with identity references.

**Handles:**
- Right: Source handle to connect to Prompt node

**Properties:**
```typescript
interface ElementNodeData {
  frontalImageUrl: string;
  referenceImageUrls: string[];
  name: string;
  tagAssignment?: string; // e.g., "@Element1"
}
```

---

### 4. Video Node

**Purpose:** Holds video for reference or editing.

**Handles:**
- Right: Source handle to connect to Prompt node
- Left: Target handle (when used as output that can chain)

**Properties:**
```typescript
interface VideoNodeData {
  videoUrl: string;
  thumbnail: string;
  fileName: string;
  duration: number;
  role: 'input' | 'output' | 'reference';
  tagAssignment?: string; // e.g., "@Video1"
  generatedFrom?: string; // ID of prompt node that created it
}
```

---

### 5. Output Video Node

**Purpose:** Displays generated video with option to convert to reference.

**Handles:**
- Left: Target handle (receives from Prompt)
- Right: Source handle (available when role switched to reference)

**Properties:**
```typescript
interface OutputVideoNodeData extends VideoNodeData {
  role: 'output' | 'reference';
  canChain: boolean;
  generationMetadata: {
    promptUsed: string;
    modelUsed: string;
    duration: number;
    createdAt: Date;
  };
}
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NOVA MACHINE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         PRESENTATION LAYER                           │    │
│  │                                                                       │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │    │
│  │  │   Canvas    │  │   Toolbar   │  │   Sidebar   │  │  Modals     │ │    │
│  │  │ (ReactFlow) │  │  Controls   │  │   Panel     │  │  System     │ │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │    │
│  │                                                                       │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │  │                    CUSTOM NODE COMPONENTS                        │ │    │
│  │  │  PromptNode | ImageNode | VideoNode | ElementNode | OutputNode  │ │    │
│  │  └─────────────────────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                          STATE LAYER                                 │    │
│  │                                                                       │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │    │
│  │  │   Zustand   │  │  ReactFlow  │  │   Project   │  │  Generation │ │    │
│  │  │    Store    │  │    State    │  │    State    │  │    Queue    │ │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         SERVICE LAYER                                │    │
│  │                                                                       │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │    │
│  │  │   Model     │  │    File     │  │    Tag      │  │  Connection │ │    │
│  │  │  Selector   │  │   Upload    │  │   Parser    │  │  Validator  │ │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                           API LAYER                                  │    │
│  │                                                                       │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │    │
│  │  │                     fal.ai Client                                │ │    │
│  │  │  subscribe() | queue.submit() | queue.status() | storage.upload()│ │    │
│  │  └─────────────────────────────────────────────────────────────────┘ │    │
│  │                                                                       │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │    │
│  │  │ Image-to-  │  │ Reference- │  │  Video-to- │  │  Video-to- │     │    │
│  │  │   Video    │  │  to-Video  │  │ Video Edit │  │ Video Ref  │     │    │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Pipeline

### 1. File Upload Flow

```
User drops file → Detect file type → Show role modal → Upload to fal.storage
                                          │
                                          ▼
                            ┌─────────────────────────┐
                            │   Role Selection Modal   │
                            │                          │
                            │  Image Options:          │
                            │  • @Image1, @Image2...   │
                            │  • Start Frame           │
                            │  • End Frame             │
                            │                          │
                            │  Video Options:          │
                            │  • @Video1               │
                            │  • Edit Source           │
                            │                          │
                            │  Element Options:        │
                            │  • Create @Element1...   │
                            └─────────────────────────┘
                                          │
                                          ▼
                            Create Node at drop position
```

### 2. Generation Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GENERATION PIPELINE                              │
└─────────────────────────────────────────────────────────────────────────┘

Step 1: Collect Inputs
────────────────────────────────────────────────────────────────────────────
  • Parse prompt for tags (@Image1, @Element1, @Video1)
  • Resolve tags to connected node data
  • Collect all connected node information

Step 2: Determine Model
────────────────────────────────────────────────────────────────────────────

  hasVideo? ─────┬───── YES ──── hasEditInstructions? ─── YES ─── V2V-EDIT
                 │                        │
                 │                        NO
                 │                        │
                 │               V2V-REFERENCE
                 │
                 NO
                 │
  hasElements? ──┬───── YES ──── REFERENCE-TO-VIDEO
                 │
                 NO
                 │
  hasImages? ────┬───── YES ──── IMAGE-TO-VIDEO
                 │
                 NO ──── ERROR: No valid inputs

Step 3: Build Request Payload
────────────────────────────────────────────────────────────────────────────
  • Map tags to actual URLs
  • Build elements array from @Element nodes
  • Add generation parameters (duration, aspect ratio, etc.)

Step 4: Execute Generation
────────────────────────────────────────────────────────────────────────────
  • Submit to fal.ai queue
  • Poll for status updates
  • Update UI with progress
  • Handle completion or error

Step 5: Create Output Node
────────────────────────────────────────────────────────────────────────────
  • Create VideoNode at right of PromptNode
  • Connect PromptNode → OutputVideoNode
  • Store generation metadata
  • Enable "convert to reference" option
```

### 3. Model Selection Logic

```typescript
function selectModel(connections: NodeConnection[]): KlingModel {
  const hasVideo = connections.some(c => c.type === 'video');
  const hasElements = connections.some(c => c.type === 'element');
  const hasImages = connections.some(c => c.type === 'image');
  const promptHasEditIntent = detectEditIntent(prompt);

  if (hasVideo) {
    if (promptHasEditIntent) {
      return 'fal-ai/kling-video/o1/video-to-video/edit';
    }
    return 'fal-ai/kling-video/o1/video-to-video/reference';
  }

  if (hasElements || hasImages) {
    if (hasElements) {
      return 'fal-ai/kling-video/o1/reference-to-video';
    }
    return 'fal-ai/kling-video/o1/image-to-video';
  }

  throw new Error('No valid inputs connected');
}
```

---

## Technology Stack

### Core Framework
- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety

### Canvas & Nodes
- **@xyflow/react (React Flow)** - Node-based canvas
- **Custom node components** - Specialized media nodes

### State Management
- **Zustand** - Global state management
- **React Flow state** - Canvas state (nodes, edges)

### UI Components
- **Cult UI** - Clean, copy-paste components
- **Prompt Kit** - AI chat interface components
- **Tailwind CSS 4.1+** - Styling
- **shadcn/ui** - Base component system

### API Integration
- **@fal-ai/client** - fal.ai SDK for KLing models

### File Handling
- **fal.storage** - File upload to fal.ai
- Native File API - Local file handling

---

## UI/UX Specifications

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ┌─────┐  NovaMachine                              [Settings] [Account] │
│  │ ≡   │                                                                │
├──┴─────┴────────────────────────────────────────────────────────────────┤
│         │                                                               │
│  NODE   │                     INFINITE CANVAS                           │
│  PANEL  │                                                               │
│         │      ┌─────────┐         ┌─────────┐         ┌─────────┐     │
│ ──────  │      │ @Image1 │────────▶│ PROMPT  │────────▶│ OUTPUT  │     │
│ + Image │      └─────────┘         │         │         │ VIDEO   │     │
│ + Video │                          │ Text... │         └─────────┘     │
│ +Element│      ┌─────────┐         │         │                         │
│ +Prompt │      │@Element1│────────▶│[Generate]│                         │
│         │      └─────────┘         └─────────┘                         │
│         │                                                               │
│         │                                                               │
├─────────┴───────────────────────────────────────────────────────────────┤
│  [Zoom: 100%]  [Fit View]  [Mini Map]                    [Clear Canvas] │
└─────────────────────────────────────────────────────────────────────────┘
```

### Color System

| Element | Color | Hex |
|---------|-------|-----|
| Background | Dark Gray | #0A0A0A |
| Node Background | Gray | #171717 |
| Node Border | Neutral | #262626 |
| @Image Tag/Border | Blue | #3B82F6 |
| @Element Tag/Border | Red | #EF4444 |
| @Video Tag/Border | Purple | #8B5CF6 |
| Primary Action | Cyan | #06B6D4 |
| Success | Green | #22C55E |
| Error | Red | #EF4444 |

### Node Dimensions

| Node Type | Width | Min Height |
|-----------|-------|------------|
| Prompt Node | 320px | 200px |
| Image Node | 200px | 160px |
| Video Node | 240px | 180px |
| Element Node | 220px | 200px |
| Output Node | 280px | 200px |

### Animations

- **Tag highlight**: 2s pulse animation on matching node borders
- **Connection draw**: 300ms ease-out edge animation
- **Node appear**: 200ms scale-in animation
- **Generation progress**: Infinite shimmer on prompt node

---

## File Structure

```
nova-machine/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── api/
│       └── generate/
│           └── route.ts
├── components/
│   ├── canvas/
│   │   ├── NovaCanvas.tsx
│   │   ├── CanvasControls.tsx
│   │   └── MiniMap.tsx
│   ├── nodes/
│   │   ├── PromptNode.tsx
│   │   ├── ImageNode.tsx
│   │   ├── VideoNode.tsx
│   │   ├── ElementNode.tsx
│   │   └── OutputNode.tsx
│   ├── edges/
│   │   └── TaggedEdge.tsx
│   ├── modals/
│   │   ├── FileRoleModal.tsx
│   │   └── GenerationModal.tsx
│   ├── prompt/
│   │   ├── PromptInput.tsx
│   │   └── TagAutocomplete.tsx
│   ├── sidebar/
│   │   └── NodePanel.tsx
│   └── ui/
│       └── (shadcn + cult-ui components)
├── lib/
│   ├── fal/
│   │   ├── client.ts
│   │   ├── models.ts
│   │   └── upload.ts
│   ├── canvas/
│   │   ├── model-selector.ts
│   │   ├── tag-parser.ts
│   │   └── connection-validator.ts
│   └── utils/
│       └── helpers.ts
├── stores/
│   ├── canvas-store.ts
│   ├── generation-store.ts
│   └── project-store.ts
├── types/
│   ├── nodes.ts
│   ├── api.ts
│   └── canvas.ts
├── hooks/
│   ├── useGeneration.ts
│   ├── useFileUpload.ts
│   └── useTags.ts
└── docs/
    └── PROJECT_DOCUMENTATION.md
```

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Project setup with Next.js 16 + TypeScript
- [ ] Install and configure dependencies
- [ ] Set up React Flow canvas
- [ ] Create base node components

### Phase 2: Node System
- [ ] Implement all node types (Prompt, Image, Video, Element, Output)
- [ ] Create custom handles and edges
- [ ] Implement drag & drop file upload
- [ ] Build file role selection modal

### Phase 3: Tag System
- [ ] Implement tag parser for prompts
- [ ] Create tag autocomplete component
- [ ] Add visual highlighting for tags and nodes
- [ ] Implement connection validation

### Phase 4: Generation Engine
- [ ] Integrate fal.ai SDK
- [ ] Implement model selection logic
- [ ] Build generation pipeline
- [ ] Add progress tracking and status updates

### Phase 5: Output & Chaining
- [ ] Create output video node
- [ ] Implement "convert to reference" functionality
- [ ] Enable video chaining workflows
- [ ] Add generation history

### Phase 6: Polish
- [ ] Implement all UI animations
- [ ] Add keyboard shortcuts
- [ ] Optimize performance
- [ ] Add error handling and recovery
