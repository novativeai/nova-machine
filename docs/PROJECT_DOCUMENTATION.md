# Nova Machine - Complete Application Documentation

## Overview

**Nova Machine** is a React Flow-based canvas application for AI video and image generation using fal.ai APIs. It provides a visual node-based workflow editor where users can create, connect, and generate AI-powered media through an intuitive drag-and-drop interface.

**Repository**: https://github.com/novativeai/nova-machine
**Version**: 0.1.0 (MVP)

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Architecture Overview](#architecture-overview)
3. [Node System](#node-system)
4. [Tag System](#tag-system)
5. [State Management](#state-management)
6. [API Integration](#api-integration)
7. [UI Components](#ui-components)
8. [Features & Functionality](#features--functionality)
9. [Utility Functions](#utility-functions)
10. [Styling & Theming](#styling--theming)
11. [Running the Application](#running-the-application)

---

## Tech Stack

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| Next.js | ^15.1.0 | React framework with App Router |
| React | ^19.0.0 | UI library |
| React Flow | ^12.3.6 | Canvas/node-based editor |
| Zustand | ^5.0.2 | State management |
| Tailwind CSS | ^4.0.0 | Styling |
| fal.ai Client | ^1.2.1 | AI generation API |
| fal.ai Server Proxy | ^1.1.1 | Secure API proxying |
| Framer Motion | ^11.15.0 | Animations |
| Lucide React | ^0.468.0 | Icons |
| Radix UI | Various | Headless UI components (Dialog, Dropdown, Popover, Select, Slider, Tooltip) |
| nanoid | ^5.0.9 | Unique ID generation |
| clsx + tailwind-merge | Latest | Class name utilities |
| class-variance-authority | ^0.7.1 | Variant styling |
| react-dropzone | ^14.3.5 | File drag-and-drop |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| TypeScript | ^5.7.2 | Type safety |
| ESLint | ^9.17.0 | Linting |
| @tailwindcss/postcss | ^4.0.0 | Tailwind processing |

### Runtime Configuration

- **Turbopack** enabled for fast development builds
- **Node.js runtime** for API routes
- **5-minute timeout** for generation API calls

---

## Architecture Overview

### Project Structure

```
nova-machine/
├── app/                           # Next.js App Router
│   ├── api/fal/                   # API routes for fal.ai
│   │   ├── proxy/route.ts         # Proxy for fal.ai requests (GET/POST/PUT)
│   │   └── upload/route.ts        # File upload to fal storage (POST)
│   ├── globals.css                # Global styles + animations
│   ├── layout.tsx                 # Root layout with providers
│   └── page.tsx                   # Main application page
├── components/
│   ├── canvas/
│   │   └── NovaCanvas.tsx         # React Flow canvas wrapper
│   ├── edges/
│   │   └── TaggedEdge.tsx         # Custom edge with tag labels
│   ├── layout/
│   │   └── Header.tsx             # Application header
│   ├── modals/
│   │   ├── ElementConfigModal.tsx # Element type/name config
│   │   ├── FileRoleModal.tsx      # File role selection
│   │   └── MediaViewer.tsx        # Fullscreen media viewer
│   ├── nodes/
│   │   ├── CameraNode.tsx         # Cinematography settings
│   │   ├── ElementNode.tsx        # Character/object definition
│   │   ├── ImageNode.tsx          # Image input node
│   │   ├── LightingNode.tsx       # Lighting settings
│   │   ├── OutputNode.tsx         # Generated media display
│   │   ├── PromptNode.tsx         # Central generation hub
│   │   ├── VideoNode.tsx          # Video input node
│   │   └── index.ts               # Node exports
│   ├── prompt/
│   │   ├── TagAutocomplete.tsx    # @ mention autocomplete
│   │   └── index.ts
│   ├── sidebar/
│   │   └── Sidebar.tsx            # Node palette sidebar
│   └── ui/
│       ├── input.tsx              # Input component
│       ├── select.tsx             # Select component
│       ├── textarea.tsx           # Textarea component
│       ├── texture-button.tsx     # Textured button component
│       └── index.ts
├── hooks/
│   ├── useBackgroundUpload.ts     # Background file upload management
│   ├── useGeneration.ts           # Generation orchestration
│   └── index.ts
├── lib/
│   ├── fal/
│   │   ├── client.ts              # fal.ai client setup & cost calculation
│   │   ├── model-selector.ts      # Automatic model selection
│   │   ├── tag-parser.ts          # Tag parsing & suggestions
│   │   └── index.ts
│   └── utils.ts                   # Utility functions
├── stores/
│   ├── canvas-store.ts            # Canvas state with persistence
│   ├── generation-store.ts        # Generation queue tracking
│   ├── modal-store.ts             # Modal visibility state
│   └── index.ts
├── types/
│   ├── api.ts                     # API type definitions
│   ├── nodes.ts                   # Node type definitions
│   └── index.ts
└── docs/
    ├── PROJECT_DOCUMENTATION.md   # This file
    └── TYPES.md                   # Type reference
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER INTERACTION                                   │
│  (File drop, Node creation, Edge connection, Prompt editing, Generate)       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             MODAL STORE                                      │
│  FileRoleModal │ MediaViewer │ ElementConfigModal                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CANVAS STORE                                     │
│  Nodes │ Edges │ Selections │ Tags │ Highlights │ Persistence               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌───────────────────────┐ ┌─────────────────┐ ┌─────────────────────────────┐
│  BACKGROUND UPLOAD    │ │ GENERATION HOOK │ │ GENERATION STORE            │
│  startUpload()        │ │ buildApiInput() │ │ queue │ active │ history    │
│  waitForUpload()      │ │ startGenerate() │ │                             │
└───────────────────────┘ └─────────────────┘ └─────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            fal.ai API                                        │
│  /api/fal/proxy (generation) │ /api/fal/upload (files)                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OUTPUT NODE CREATED                                │
│  Video/Image result displayed with metadata and download option              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Node System

Nova Machine supports **7 node types**, each with specific functionality:

### 1. Prompt Node (`components/nodes/PromptNode.tsx`)

**Purpose**: Central generation hub for creating AI videos/images

**Features**:
- **Dual Mode**: Toggle between Video and Image generation modes
- **Tag Autocomplete**: Type `@` to reference connected nodes with dropdown suggestions
- **Syntax Highlighting**: Tags highlighted in prompt text with type-specific colors
- **Model Selection**: Automatic model selection based on connected inputs
- **Cost Estimation**: Real-time cost display before generation (based on model + settings)
- **Progress Tracking**: Shows generation progress percentage with shimmer animation
- **Connected Tags Preview**: Shows all connected node tags with highlight status

**Settings by Mode**:
- **Video Mode**: Duration (5s/10s), Aspect Ratio (16:9, 9:16, 1:1)
- **Image Mode**: Aspect Ratio (21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16), Resolution (1K/2K/4K)

**Handles**: 3 inputs (left at 30%, 50%, 70%), 1 output (right)

**Data Properties**:
```typescript
interface PromptNodeData {
  prompt: string;
  negativePrompt: string;
  mode: 'video' | 'image';
  duration: '5' | '10';
  aspectRatio: '16:9' | '9:16' | '1:1';
  imageAspectRatio: '21:9' | '16:9' | '3:2' | '4:3' | '5:4' | '1:1' | '4:5' | '3:4' | '2:3' | '9:16';
  imageResolution: '1K' | '2K' | '4K';
  cfgScale: number;
  status: 'idle' | 'uploading' | 'queued' | 'generating' | 'completed' | 'error';
  progress: number;
  error?: string;
  selectedModel?: string;
  connectedInputs: ConnectedInput[];
}
```

---

### 2. Image Node (`components/nodes/ImageNode.tsx`)

**Purpose**: Reference or frame image input for generation

**Features**:
- **File Upload**: Click to select or drag-drop images onto canvas
- **Role Cycling**: Click role badge to cycle Reference → Start Frame → End Frame
- **Pop Animation**: Subtle scale animation when changing roles
- **Tag Assignment**: Automatic `@Image1`, `@Image2` tags when connected to prompt
- **Preview**: Thumbnail display with file info (name, size, dimensions)
- **Background Upload**: Files automatically upload to fal.ai storage in background

**Handles**: 1 input (left for chaining), 1 output (right)

**Roles**:
| Role | Purpose | Tagged |
|------|---------|--------|
| `reference` | Style/composition reference for generation | Yes |
| `start_frame` | First frame for image-to-video animation | No |
| `end_frame` | Final frame for image-to-video animation | No |

**Data Properties**:
```typescript
interface ImageNodeData {
  imageUrl: string;           // Blob URL for preview
  thumbnailUrl: string;
  fileName: string;
  fileSize: number;
  dimensions: { width: number; height: number };
  role: 'reference' | 'start_frame' | 'end_frame';
  tagAssignment?: string;     // e.g., "@Image1"
  isHighlighted: boolean;
  file?: File;
  uploadStatus?: 'idle' | 'uploading' | 'completed' | 'error';
  remoteUrl?: string;         // fal.ai storage URL
  uploadError?: string;
}
```

---

### 3. Video Node (`components/nodes/VideoNode.tsx`)

**Purpose**: Video input for editing or motion reference

**Features**:
- **Video Preview**: Thumbnail with play icon overlay
- **Duration Display**: Shows video length in corner badge
- **Role Selection**: Reference (for style) or Edit Source (for editing)
- **Tag Assignment**: `@Video1`, `@Video2`, etc. when connected
- **Background Upload**: Automatic upload to fal.ai storage

**Handles**: 1 input (left for chaining), 1 output (right)

**Roles**:
| Role | Purpose | Model Triggered |
|------|---------|-----------------|
| `reference` | Motion/style reference | Video-to-Video Reference |
| `edit_source` | Video to edit with prompts | Video-to-Video Edit |

**Data Properties**:
```typescript
interface VideoNodeData {
  videoUrl: string;
  thumbnailUrl: string;
  fileName: string;
  fileSize: number;
  duration: number;
  dimensions: { width: number; height: number };
  role: 'reference' | 'edit_source';
  tagAssignment?: string;
  isHighlighted: boolean;
  file?: File;
  uploadStatus?: UploadStatus;
  remoteUrl?: string;
  uploadError?: string;
}
```

---

### 4. Element Node (`components/nodes/ElementNode.tsx`)

**Purpose**: Character or object definition with multiple reference images

**Features**:
- **Frontal Image**: Primary face/front view (required for generation)
- **Reference Angles**: Grid of additional perspective images (optional)
- **Inline Name Editing**: Click name to edit directly on node
- **Drag-and-Drop**: Drop multiple images (first = frontal, rest = references)
- **Type Selection**: Character (person icon) or Object (box icon)
- **Tag Assignment**: `@Element1`, `@Element2`, etc.
- **Image Removal**: Remove individual reference images with X button
- **Connected Image Sync**: Automatically pulls images from connected ImageNodes

**Handles**: 1 input (left for image connections), 1 output (right)

**Data Properties**:
```typescript
interface ElementNodeData {
  name: string;
  elementType: 'character' | 'object';
  frontalImageUrl: string;
  frontalThumbnail: string;
  frontalFile?: File;
  referenceImageUrls: string[];
  referenceThumbnails: string[];
  referenceFiles?: File[];
  tagAssignment?: string;
  isHighlighted: boolean;
  frontalUploadStatus?: UploadStatus;
  frontalRemoteUrl?: string;
  referenceUploadStatus?: UploadStatus;
  referenceRemoteUrls?: string[];
  connectedImageSourceIds?: string[];
}
```

---

### 5. Output Node (`components/nodes/OutputNode.tsx`)

**Purpose**: Display and manage generated media with actions

**Features**:
- **Video Player**: Built-in controls (play/pause, seek bar, duration, mute)
- **Image Display**: Full preview with aspect-ratio preservation
- **Fullscreen Viewer**: Click to open in modal with keyboard shortcuts
- **Download**: Save generated media locally with proper filename
- **Chain/Reference**: Convert output to reference for further generation
- **Metadata Display**: Model used, duration/resolution, aspect ratio, cost
- **Prompt Display**: Shows the original prompt used (line-clamped)

**Handles**: 1 input (left), 1 output (right, **only visible when converted to reference**)

**Conversion Feature**:
- Video outputs: "Chain" button → becomes video reference with output handle
- Image outputs: "Use as Ref" button → becomes image reference with output handle

**Data Properties**:
```typescript
interface OutputNodeData {
  outputType: 'video' | 'image';
  videoUrl?: string;
  videoDuration?: number;
  imageUrl?: string;
  thumbnailUrl: string;
  dimensions: { width: number; height: number };
  role: 'output' | 'reference';
  canChain: boolean;
  tagAssignment?: string;
  isHighlighted: boolean;
  generationMetadata: {
    promptUsed: string;
    modelUsed: string;
    inputNodes: string[];
    duration?: number;
    aspectRatio: string;
    resolution?: string;
    createdAt: Date;
    requestId: string;
    cost: number;
  };
}
```

---

### 6. Camera Node (`components/nodes/CameraNode.tsx`)

**Purpose**: Cinematography settings that inject into generation prompts

**Features**:
- **14 Camera Angles**: Eye Level, Low Angle, High Angle, Dutch Angle, Bird's Eye View, Worm's Eye View, Over-the-Shoulder, Point-of-View, Close-Up, Extreme Close-Up, Wide Shot, Establishing Shot, Tracking Shot, Dolly Zoom
- **9 Lens Lengths**: 14mm, 24mm, 35mm, 50mm, 85mm, 100mm Macro, 135mm, 200mm, 400mm
- **11 Color Grades**: Natural, Black & White, Teal & Orange, Vintage Film, Warm Golden Hour, Cold Blue, Neon Cyberpunk, Muted Desaturated, High Contrast, Pastel Soft, Sepia
- **Settings Preview**: Shows all active settings in amber-colored section
- **Prompt Injection**: Settings formatted and appended to prompt automatically
- **Active Badge**: Shows "Active" when any setting is selected

**Handles**: 1 output (right)

**Color Theme**: Amber (#F59E0B)

**Data Properties**:
```typescript
interface CameraNodeData {
  cameraAngle: CameraAngle | '';
  lensLength: LensLength | '';
  colorimetry: Colorimetry | '';
}
```

---

### 7. Lighting Node (`components/nodes/LightingNode.tsx`)

**Purpose**: Lighting style and mood settings for cinematic control

**Features**:
- **15 Lighting Styles**: Rembrandt, Butterfly, Split, Loop, Broad, Short, Rim, Backlighting, Silhouette, Three-Point, Natural, Practical, Motivated, Soft Diffused, Hard Dramatic
- **11 Lighting Keys**: Low-Key (Dark/Dramatic), High-Key (Bright/Airy), Natural-Key, Chiaroscuro, Flat, Dramatic, Moody, Ethereal, Noir, Golden Hour, Blue Hour
- **Settings Preview**: Shows active settings in yellow-colored section
- **Prompt Injection**: Settings formatted and appended to prompt automatically
- **Active Badge**: Shows "Active" when any setting is selected

**Handles**: 1 output (right)

**Color Theme**: Yellow (#FBBF24)

**Data Properties**:
```typescript
interface LightingNodeData {
  lightingStyle: LightingStyle | '';
  lightingKey: LightingKey | '';
}
```

---

## Tag System

### Per-Prompt Tag Scoping

Tags are scoped to each prompt node independently, enabling multi-prompt workflows:

```
Prompt A connections: @Image1, @Image2, @Element1
Prompt B connections: @Image1, @Video1 (separate numbering scope)
```

### Tag Types

| Type | Prefix | Color | Hex | Applicable Nodes |
|------|--------|-------|-----|------------------|
| Image | `@Image` | Blue | #3B82F6 | ImageNode (role=reference), OutputNode (image) |
| Element | `@Element` | Red | #EF4444 | ElementNode |
| Video | `@Video` | Purple | #8B5CF6 | VideoNode, OutputNode (video) |

### Tag Assignment Logic

1. **Trigger**: Tags recalculated when edges are added or removed
2. **Scope**: Each prompt calculates tags independently
3. **Storage**: Tags stored on edges (`edge.data.tag`) and displayed on nodes (`node.data.tagAssignment`)
4. **Filtering**: Only nodes with `role='reference'` get tagged (start/end frames excluded)
5. **Ordering**: Tags assigned based on edge creation order

### Tag Autocomplete

**Trigger**: Type `@` character in prompt textarea

**Features**:
- Dropdown appears below cursor position
- Arrow keys (↑/↓) to navigate suggestions
- Enter or Tab to select and insert tag
- Escape to close dropdown
- Shows thumbnail and name for each suggestion
- Filters as you type (e.g., `@Im` shows only `@Image` tags)
- Color-coded icons by tag type

### Tag Highlighting

When a tag in the prompt matches a connected node:
1. Tag text highlighted with colored background (30% opacity)
2. Corresponding node shows pulsing border glow
3. Connection edge colored to match tag type

---

## State Management

### Canvas Store (`stores/canvas-store.ts`)

**Purpose**: Manages all canvas state with localStorage persistence

**State**:
```typescript
interface CanvasState {
  nodes: NovaNode[];
  edges: NovaEdge[];
  selectedNodes: string[];
}
```

**Key Actions**:

| Action | Description |
|--------|-------------|
| `addNode(node)` | Add new node to canvas |
| `updateNode(id, data)` | Update node properties (auto-sets updatedAt) |
| `removeNode(id)` | Remove node and all connected edges |
| `addEdge(edge)` | Create connection, triggers tag recalculation |
| `removeEdge(id)` | Remove connection, triggers tag recalculation |
| `recalculateTags()` | Recalculate all tag assignments per-prompt |
| `syncElementConnections()` | Sync element nodes with connected image data |
| `getEdgeTag(sourceId, targetPromptId)` | Get tag for specific edge connection |
| `getConnectedInputs(promptNodeId)` | Get all nodes connected to a prompt |
| `getNodeByTag(tag)` | Look up node by tag assignment |
| `highlightNode(id, color)` | Set highlight state on node |
| `clearHighlights()` | Remove all node highlights |
| `clearCanvas()` | Reset all state |

**Persistence Configuration**:
- **Storage Key**: `nova-canvas-state`
- **Excluded**: File objects (non-serializable)
- **On Hydration**:
  - Date strings → Date objects
  - Generation status reset to 'idle'
  - Blob URLs restored from remote URLs if available
  - Highlight states cleared

---

### Generation Store (`stores/generation-store.ts`)

**Purpose**: Tracks generation requests through their lifecycle

**State**:
```typescript
interface GenerationState {
  queue: GenerationRequest[];
  activeGeneration: GenerationRequest | null;
  history: GenerationRequest[];
  isGenerating: boolean;
}
```

**Actions**:

| Action | Description |
|--------|-------------|
| `addToQueue(request)` | Add new generation request |
| `setActiveGeneration(request)` | Set currently processing request |
| `updateRequest(id, updates)` | Update request properties |
| `completeGeneration(id, result)` | Move to history with result |
| `failGeneration(id, error)` | Move to history with error |
| `clearHistory()` | Clear completed/failed requests |

---

### Modal Store (`stores/modal-store.ts`)

**Purpose**: Manages modal visibility and associated data

**Modals**:

| Modal | State | Purpose |
|-------|-------|---------|
| FileRoleModal | `file`, `fileType`, `previewUrl`, `dropPosition`, `targetNodeId` | Select role when adding files |
| MediaViewer | `type`, `url`, `title`, `downloadFileName` | Fullscreen media viewing |
| ElementConfigModal | `position` | Configure new element nodes |

---

## API Integration

### API Routes

#### POST `/api/fal/upload`

Uploads files to fal.ai storage for use in generation.

**Request**: `multipart/form-data` with `file` field

**Flow**:
1. Receive file from client
2. POST to `https://rest.alpha.fal.ai/storage/upload/initiate` → get signed URL
3. PUT file buffer to signed URL
4. Return permanent file URL

**Response**: `{ url: string }`

**Configuration**:
- Runtime: Node.js
- Max Duration: 5 minutes (300 seconds)
- Auth: `FAL_KEY` environment variable

---

#### GET/POST/PUT `/api/fal/proxy`

Proxies all fal.ai API requests securely.

**Purpose**:
- Hides API key from client
- Routes through Next.js server
- 5-minute timeout for long generations

**Implementation**: Uses `@fal-ai/server-proxy/nextjs` route handlers

---

### Supported AI Models

#### Video Models (KLing)

| Model | Endpoint | Use Case | Pricing |
|-------|----------|----------|---------|
| Image-to-Video | `fal-ai/kling-video/o1/image-to-video` | Animate static images with start/end frames | $0.112/second |
| Reference-to-Video | `fal-ai/kling-video/o1/reference-to-video` | Generate with reference images/elements | $0.112/second |
| Video-to-Video Edit | `fal-ai/kling-video/o1/video-to-video/edit` | Edit existing videos with prompts | $0.168/second |
| Video-to-Video Reference | `fal-ai/kling-video/o1/video-to-video/reference` | Generate variations of videos | $0.168/second |

#### Image Models (Nano Banana Pro)

| Model | Endpoint | Use Case | Pricing |
|-------|----------|----------|---------|
| Text-to-Image | `fal-ai/nano-banana-pro` | Generate images from text | $0.15 (1K/2K), $0.30 (4K) |
| Image Edit | `fal-ai/nano-banana-pro/edit` | Edit images with references | $0.15 (1K/2K), $0.30 (4K) |

---

### Model Selection Algorithm

**Video Mode** (`lib/fal/model-selector.ts`):

```
1. Has Video Input?
   ├─ YES + "edit" keywords in prompt → VIDEO-TO-VIDEO/EDIT
   └─ YES (no edit keywords) → VIDEO-TO-VIDEO/REFERENCE

2. Has Element Nodes?
   └─ YES → REFERENCE-TO-VIDEO

3. Has Image Nodes?
   ├─ Has @tags OR role='reference' → REFERENCE-TO-VIDEO
   └─ Has start/end frames only → IMAGE-TO-VIDEO

4. No Valid Inputs → ERROR
```

**Edit Intent Detection**: Checks for keywords: edit, change, replace, transform, modify, alter, adjust, convert, turn into, make it, swap

**Image Mode**:
```
1. Has Images or Elements connected?
   ├─ YES → IMAGE EDIT (nano-banana-pro/edit)
   └─ NO → TEXT-TO-IMAGE (nano-banana-pro)
```

---

### Generation Hook (`hooks/useGeneration.ts`)

**Main Functions**:

| Function | Purpose |
|----------|---------|
| `buildApiInput(promptNodeId, promptData)` | Build video generation API payload |
| `buildImageApiInput(promptNodeId, promptData)` | Build image generation API payload |
| `startGeneration(promptNodeId)` | Orchestrate full generation flow |
| `getEstimatedCost(promptNodeId)` | Calculate cost before generation |

**Generation Flow**:
1. Validate prompt and connections
2. Wait for pending background uploads
3. Build API input with all connected node data
4. Queue request in generation store
5. Call fal.ai API with progress callback
6. Create output node with result
7. Connect output to prompt node
8. Update status and complete generation

---

### Background Upload Hook (`hooks/useBackgroundUpload.ts`)

**Purpose**: Manage async file uploads to fal.ai storage

**Tracked Uploads** (keyed in Map):
- Direct nodes: `nodeId`
- Element frontal: `${nodeId}:frontal`
- Element references: `${nodeId}:references`

**Functions**:

| Function | Purpose |
|----------|---------|
| `startUpload(nodeId, file, nodeType)` | Start background upload for image/video |
| `startElementFrontalUpload(nodeId, file)` | Upload element frontal image |
| `startElementReferenceUpload(nodeId, files)` | Upload multiple reference images |
| `hasPendingUpload(nodeId)` | Check if any upload pending for node |
| `waitForUpload(nodeId)` | Wait for direct node upload to complete |
| `waitForElementUploads(nodeId)` | Wait for element uploads to complete |
| `getPendingUploadNodeIds()` | Get all nodes with pending uploads |

---

## UI Components

### NovaCanvas (`components/canvas/NovaCanvas.tsx`)

Main canvas component wrapping React Flow.

**Features**:
- **Drag-and-drop** file support (opens role modal)
- **Edge reconnection** (drag edge end to disconnect or reconnect)
- **Color-coded edges** based on source node tag type
- **MiniMap** with node type colors, pannable and zoomable
- **Controls** (zoom in/out, fit view)
- **Dot grid background** with 24px gap
- **Snap to 16px grid**
- **Viewport**: Min zoom 0.1, max zoom 2

**Edge Colors by Node Type**:
| Node Type | Edge Color |
|-----------|------------|
| Image | #3B82F6 (Blue) |
| Video | #8B5CF6 (Purple) |
| Element | #EF4444 (Red) |
| Output | #22C55E (Green) |
| Camera | #F59E0B (Amber) |
| Lighting | #FBBF24 (Yellow) |

---

### Sidebar (`components/sidebar/Sidebar.tsx`)

Node palette for adding nodes to canvas.

**Features**:
- **Collapsible**: Toggle between full (264px) and icon-only (64px) modes
- **6 Node Types**: Prompt, Image, Video, Element, Camera, Lighting
- **Click to Add**: Places node at viewport center with random offset
- **Element Modal**: Opens configuration modal before creating element nodes
- **Descriptions**: Each node type has icon and description text

---

### Header (`components/layout/Header.tsx`)

Application header bar.

**Elements**:
- Logo with Sparkles icon
- "NovaMachine" title
- "Beta" badge
- Settings button (placeholder)

---

### FileRoleModal (`components/modals/FileRoleModal.tsx`)

Role selection when adding files.

**Image Options**:
| Option | Description | Creates |
|--------|-------------|---------|
| @Image | Style/composition reference | ImageNode (role=reference) |
| Start Frame | First frame for animation | ImageNode (role=start_frame) |
| End Frame | Final frame for animation | ImageNode (role=end_frame) |
| @Element | Create character/object | Opens Element Config step |

**Video Options**:
| Option | Description | Creates |
|--------|-------------|---------|
| @Video | Motion/style reference | VideoNode (role=reference) |
| Edit Source | Video to edit | VideoNode (role=edit_source) |

**Element Config Step** (when @Element selected):
- Type selection: Character or Object
- Name input with placeholder suggestions
- Frontal image from dropped file

---

### MediaViewer (`components/modals/MediaViewer.tsx`)

Fullscreen media viewer modal.

**Video Features**:
- Play/Pause button and click-to-toggle
- Seek bar with current/total time
- Mute/unmute toggle
- Fullscreen toggle
- Download button
- Auto-hide controls after 3 seconds

**Image Features**:
- Full resolution display
- Fullscreen toggle
- Download button

**Keyboard Shortcuts**:
| Key | Action |
|-----|--------|
| `Esc` | Close viewer |
| `Space` | Play/Pause (video) |
| `M` | Mute/Unmute (video) |
| `F` | Toggle fullscreen |

---

### TaggedEdge (`components/edges/TaggedEdge.tsx`)

Custom edge component with tag label.

**Features**:
- Bezier path rendering
- Color from `edge.data.color`
- Tag label at midpoint (if `edge.data.tag` exists)
- Selection glow with drop-shadow
- Thicker stroke when selected (3px vs 2px)

---

### TagAutocomplete (`components/prompt/TagAutocomplete.tsx`)

Autocomplete dropdown for @ mentions.

**Features**:
- Positioned below cursor in textarea
- Keyboard navigation (Arrow Up/Down, Enter, Tab, Escape)
- Shows tag, icon, and optional thumbnail
- Filters by query text
- Color-coded by tag type

**Hook**: `useTagAutocomplete(textareaRef, connectedNodes)`
- Tracks open state and position
- Filters suggestions by query
- `checkForTrigger()` - detect @ in text
- `insertTag(tag)` - replace @query with full tag

---

## Features & Functionality

### Generation Workflow

1. **Add Nodes**: Drag files onto canvas or click sidebar buttons
2. **Connect**: Draw edges from node outputs to prompt inputs
3. **Configure**: Set roles, names, camera/lighting settings
4. **Write Prompt**: Use `@` tags to reference connected media
5. **Generate**: Click Generate button (validates inputs first)
6. **View Results**: Output node appears connected to prompt
7. **Chain**: Convert outputs to references for iteration

---

### Background Upload System

Files upload to fal.ai storage automatically in background:

1. **File added** to node → `startUpload()` called immediately
2. **Upload progress** tracked via `uploadStatus` property
3. **Completion** populates `remoteUrl` on node
4. **Generation** waits for all pending uploads before API call
5. **Errors** displayed on node with `uploadError` message

---

### Cost Estimation

Real-time cost displayed on prompt node before generation.

**Video Pricing**:
```
cost = price_per_second × duration_seconds

Image-to-Video:     $0.112/s × 5s = $0.560
Reference-to-Video: $0.112/s × 10s = $1.120
Video-to-Video:     $0.168/s × 5s = $0.840
```

**Image Pricing**:
```
1K/2K Resolution: $0.15
4K Resolution:    $0.30
```

---

### Canvas Persistence

State automatically persisted to localStorage:

**Saved**:
- All nodes with data (excluding File objects)
- All edges with data
- Selection state

**Restored on Load**:
- Nodes and edges from storage
- Dates reconstructed from strings
- Blob URLs replaced with remote URLs if available
- Generation status reset to 'idle'
- Highlight states cleared

---

## Utility Functions

### `lib/utils.ts`

| Function | Signature | Description |
|----------|-----------|-------------|
| `cn` | `(...classes: ClassValue[]) => string` | Merge Tailwind classes with clsx + twMerge |
| `formatFileSize` | `(bytes: number) => string` | Format as "2.5 MB" |
| `formatDuration` | `(seconds: number) => string` | Format as "1:30" |
| `formatCost` | `(cost: number) => string` | Format as "$0.560" |
| `debounce` | `<T>(fn: T, wait: number) => T` | Debounce function calls |
| `generateVideoThumbnail` | `(file: File) => Promise<string>` | Extract frame at 0.5s as data URL |
| `getVideoDuration` | `(file: File) => Promise<number>` | Get video duration in seconds |
| `getImageDimensions` | `(file: File) => Promise<{width, height}>` | Get image dimensions |
| `isImageFile` | `(file: File) => boolean` | Check MIME type starts with 'image/' |
| `isVideoFile` | `(file: File) => boolean` | Check MIME type starts with 'video/' |
| `fileToBase64` | `(file: File) => Promise<string>` | Convert to data URL |
| `createObjectUrl` | `(file: File) => string` | Create and track blob URL |
| `revokeObjectUrl` | `(url: string) => void` | Revoke tracked blob URL |
| `revokeAllObjectUrls` | `() => void` | Revoke all tracked blob URLs |

---

### `lib/fal/tag-parser.ts`

| Function | Description |
|----------|-------------|
| `parseTags(prompt)` | Extract all @tags with positions |
| `getTagsOfType(prompt, type)` | Filter tags by type |
| `hasTag(prompt, tag)` | Check if specific tag exists |
| `generateNextTag(existing, type)` | Generate next available tag number |
| `validateTags(prompt, connected)` | Check all tags have connections |
| `createTagSuggestions(nodes)` | Build autocomplete suggestion list |
| `getTagColor(type)` | Get hex color for tag type |

---

## Styling & Theming

### Color Palette

| Element | Color Name | Hex |
|---------|------------|-----|
| Primary (Prompt) | Cyan | #06B6D4 |
| Image Tag | Blue | #3B82F6 |
| Video Tag | Purple | #8B5CF6 |
| Element Tag | Red | #EF4444 |
| Output | Green | #22C55E |
| Camera | Amber | #F59E0B |
| Lighting | Yellow | #FBBF24 |
| Background | Dark | #0A0A0A |
| Node BG | Gray | #171717 |
| Border | Neutral | #262626 |

### Custom CSS Animations (`app/globals.css`)

| Animation | Duration | Effect |
|-----------|----------|--------|
| `generating-shimmer` | 2s | Gradient shimmer on generating prompt |
| `role-pop` | 0.2s | Scale 1→1.1→1 on role change |
| `pulse-blue` | 2s | Blue glow pulse for image highlights |
| `pulse-red` | 2s | Red glow pulse for element highlights |
| `pulse-purple` | 2s | Purple glow pulse for video highlights |

### Node Styling Classes

| Class | Purpose |
|-------|---------|
| `.nova-node` | Base node styling |
| `.nova-node.selected` | Selection ring |
| `.nova-node.highlighted-image` | Blue pulsing glow |
| `.nova-node.highlighted-element` | Red pulsing glow |
| `.nova-node.highlighted-video` | Purple pulsing glow |
| `.nova-drag-handle` | Draggable header area |
| `.nova-node-delete` | Delete button styling |
| `.nova-node-icon` | Icon container in header |
| `.tag-badge` | Tag pill styling |
| `.generating-shimmer` | Shimmer during generation |

---

## Running the Application

### Environment Setup

Create `.env.local` file:
```
FAL_KEY=your_fal_ai_api_key
```

### Commands

```bash
# Install dependencies
pnpm install

# Development with Turbopack
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

### Development Server

Default: http://localhost:3000 (or next available port)

---

## Version History

### v0.1.0 (MVP) - December 2024

**Features Implemented**:
- 7 node types (Prompt, Image, Video, Element, Output, Camera, Lighting)
- Dual-mode generation (Video/Image)
- Per-prompt tag scoping system
- Automatic model selection based on inputs
- Background file uploads to fal.ai storage
- Real-time cost estimation
- Canvas state persistence to localStorage
- Fullscreen media viewer with keyboard shortcuts
- Role cycling for image nodes with pop animation
- Edge reconnection and disconnection
- Tag autocomplete with thumbnail previews
- Cinematography controls (camera angles, lenses, color grading)
- Lighting controls (styles, keys/tones)
- Output chaining for iterative generation

---

*Documentation generated for Nova Machine MVP*
*Last updated: December 2024*
