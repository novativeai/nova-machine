# Video Assets for Landing Page

This directory contains all video assets for the Nova Machine landing page.

## Required Videos

### Hero Section (Full-screen backgrounds)
- `hero-workflow.mp4` - Canvas workflow demonstration (15s loop, 16:9, 1080p)
- `hero-results.mp4` - Before/after results showcase (15s loop, 16:9, 1080p)
- `hero-features.mp4` - Feature highlights (15s loop, 16:9, 1080p)

### Feature Grid (Large video cards)
- `feature-nodes.mp4` - Node-based workflow demo (10s loop, 16:9, 1080p)
- `feature-ai.mp4` - AI model selection demo (10s loop, 16:9, 1080p)
- `feature-chain.mp4` - Video chaining workflow (12s loop, 16:9, 1080p)
- `feature-controls.mp4` - Camera/lighting controls (10s loop, 16:9, 1080p)

### How It Works Steps
- `step-1.mp4` - Adding media to canvas (10s, 16:9, 1080p)
- `step-2.mp4` - Connecting and configuring (10s, 16:9, 1080p)
- `step-3.mp4` - Generating and refining (10s, 16:9, 1080p)

### Gallery Showcase
- `gallery-1.mp4` - User-generated example 1 (5-10s, 9:16, vertical)
- `gallery-2.mp4` - User-generated example 2 (5-10s, 9:16, vertical)
- `gallery-3.mp4` - User-generated example 3 (5-10s, 9:16, vertical)
- `gallery-4.mp4` - User-generated example 4 (5-10s, 9:16, vertical)
- `gallery-5.mp4` - User-generated example 5 (5-10s, 9:16, vertical)
- `gallery-6.mp4` - User-generated example 6 (5-10s, 9:16, vertical)

## Poster Images

All videos should have corresponding poster images in `/public/videos/posters/`:
- `hero-workflow.jpg`
- `hero-results.jpg`
- etc.

## Video Specifications

### Encoding
```bash
# Compress for web (H.264, optimized)
ffmpeg -i input.mp4 -c:v libx264 -crf 28 -preset slow -c:a aac -b:a 128k output.mp4

# Create mobile version (lower bitrate)
ffmpeg -i input.mp4 -vf scale=960:-1 -c:v libx264 -crf 32 output-mobile.mp4

# Generate poster frame
ffmpeg -i input.mp4 -ss 00:00:01 -frames:v 1 poster.jpg
```

### Size Targets
- Hero videos: <5MB each
- Feature videos: <3MB each
- Gallery videos: <2MB each
- Posters: <200KB each (JPEG, quality 85)

## Production Workflow

1. **Record Screen**: Use QuickTime/OBS to record canvas interactions
2. **Generate Samples**: Use fal.ai to create example outputs
3. **Edit**: Trim, add transitions if needed (keep minimal)
4. **Compress**: Run through ffmpeg with above settings
5. **Test**: Verify autoplay works in browser
6. **Upload**: Place in `/public/videos/`

## Temporary Placeholders

During development, you can use:
- Sample videos from fal.ai generations
- Screen recordings of the canvas
- Stock footage with watermarks (replace before production)

## Notes

- All videos should be muted and loop seamlessly
- Optimize for fast loading (CDN recommended for production)
- Consider lazy loading for below-the-fold videos
- Test on mobile devices for performance
