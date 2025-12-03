# NovaMachine

A node-based AI Video Generator powered by KLing O1 models via fal.ai.

## Features

- **Infinite Canvas**: Visual node-based workflow using React Flow
- **Multiple AI Models**: Automatic model selection based on inputs
  - Image-to-Video: Animate images with text guidance
  - Reference-to-Video: Generate with character/style references
  - Video-to-Video Edit: Transform videos with natural language
  - Video-to-Video Reference: Create new shots from reference videos
- **Tag System**: Visual @Image, @Element, @Video tags with color-coded highlighting
- **Drag & Drop**: Easy file import with role selection
- **Video Chaining**: Use outputs as inputs for iterative generation

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- fal.ai API key

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd nova-machine

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your FAL_KEY

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to use NovaMachine.

## Usage

### Basic Workflow

1. **Add a Prompt Node**: Click "Prompt" in the sidebar or drag from panel
2. **Add Media Nodes**: Drag & drop images/videos onto the canvas
3. **Select Role**: Choose how to use the media (@Image, @Element, @Video, etc.)
4. **Connect Nodes**: Drag from node handles to connect inputs to prompt
5. **Write Prompt**: Use tags like `@Image1`, `@Element1` to reference connected nodes
6. **Generate**: Click "Generate Video" to create your video

### Tag System

| Tag | Color | Usage |
|-----|-------|-------|
| `@Image1`, `@Image2`... | Blue | Reference images for style/composition |
| `@Element1`, `@Element2`... | Red | Character or object definitions |
| `@Video1` | Purple | Reference video for motion/style |

### Model Selection

The system automatically selects the appropriate model:

- **Video input** → Video-to-Video (Edit or Reference)
- **Element nodes** → Reference-to-Video
- **@Image tags** → Reference-to-Video
- **Start/End frames** → Image-to-Video

## Project Structure

```
nova-machine/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Main canvas page
│   └── globals.css        # Global styles
├── components/
│   ├── canvas/            # React Flow canvas
│   ├── nodes/             # Custom node components
│   ├── modals/            # Modal dialogs
│   ├── sidebar/           # Node palette
│   └── layout/            # Layout components
├── lib/
│   └── fal/               # fal.ai integration
├── stores/                # Zustand stores
├── hooks/                 # React hooks
├── types/                 # TypeScript types
└── docs/                  # Documentation
```

## Technology Stack

- **Next.js 15** with App Router
- **React 19** with TypeScript
- **React Flow** for node-based UI
- **Zustand** for state management
- **Tailwind CSS 4** for styling
- **fal.ai SDK** for AI generation

## API Pricing

| Model | Price |
|-------|-------|
| Image-to-Video | $0.112/sec |
| Reference-to-Video | $0.112/sec |
| Video-to-Video Edit | $0.168/sec |
| Video-to-Video Reference | $0.168/sec |

## Development

```bash
# Run development server
pnpm dev

# Type check
pnpm typecheck

# Build for production
pnpm build

# Start production server
pnpm start
```

## Documentation

See [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md) for detailed documentation including:
- Complete API reference
- System architecture
- Type definitions
- Implementation details

## License

MIT
