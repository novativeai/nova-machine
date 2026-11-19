# LTX Studio-Inspired Landing Page Redesign Plan

**Status**: Ready for Implementation
**Reference**: https://ltx.studio/home-v2
**Estimated Time**: 4-6 hours full implementation

---

## Design System Changes ✅

**Completed**:
- Added LTX color tokens to `globals.css`
- Navy backgrounds (#252830)
- Electric blue accents (#2b61ff, #4d65ff)
- Pink-to-blue gradients (#F13783 to #1D29A9)
- Off-white text (#fdfdfd)

---

## Implementation Priority

### Phase 1: Infrastructure (30 min)
1. **Smooth Scroll Provider** - Lenis integration
2. **Marketing Layout** - New layout with sticky nav
3. **Font Loading** - Inter, Montserrat or similar

### Phase 2: Hero Section (1 hour)
1. **Tabbed Video Carousel**
   - 3 tabs with video backgrounds
   - 15-second auto-rotation
   - Manual tab switching
   - Progress bars
   - Poster images
2. **Hero Content**
   - Large headline
   - Subheading
   - CTA buttons
   - Background gradient overlay

### Phase 3: Core Sections (2 hours)
1. **Gen Space** - 4 feature cards with hover videos
2. **Control** - 3 control mechanism cards
3. **Style** - Large video showcase
4. **Elements** - 3 consistency cards

### Phase 4: Advanced Features (1.5 hours)
1. **Vertical Marquee Gallery** - Infinite scroll videos
2. **Expandable Benefits Cards** - Hover to expand
3. **Testimonials Carousel** - Social proof
4. **FAQ Accordion** - Common questions

### Phase 5: Animations (1 hour)
1. **GSAP Scroll Triggers** - Staircase card effect
2. **Intersection Observers** - Video play on scroll
3. **Hover Effects** - Scale, opacity, reveal
4. **Cursor Effects** - Custom glass cursor (optional)

---

## New Components to Build

### `/components/marketing/`
- `SmoothScrollProvider.tsx` - Lenis wrapper
- `MarketingNav.tsx` - Sticky navigation
- `HeroCarousel.tsx` - Tabbed video hero
- `GradientBanner.tsx` - Announcement banner
- `FeatureSection.tsx` - Reusable feature layout
- `VideoCard.tsx` - Hover-to-play card
- `ExpandableCard.tsx` - Hover expand effect
- `VerticalMarquee.tsx` - Infinite scroll column
- `TestimonialCarousel.tsx` - Reviews slider
- `FAQAccordion.tsx` - Expandable questions

### `/components/ui/`
- `TabCarousel.tsx` - Generic tab carousel
- `ProgressBar.tsx` - Animated progress
- `VideoPlayer.tsx` - Enhanced video component

---

## Content Structure

```
Marketing Layout
├── Navigation (sticky)
│   ├── Logo
│   ├── Solutions (dropdown)
│   ├── Resources (dropdown)
│   ├── Pricing
│   └── CTA buttons
│
├── Hero Section
│   ├── Tabbed Carousel (3 slides)
│   ├── Headline + Subheading
│   └── Primary CTA
│
├── Gradient Banner
│   └── Announcement (animated gradient)
│
├── Intro Section
│   ├── Headline
│   ├── Description
│   └── CTA
│
├── Gen Space Section
│   ├── Section header
│   └── 4 feature cards (2x2 grid)
│       ├── Text to Video
│       ├── Image to Video
│       ├── Video to Video
│       └── AI Controls
│
├── Control Section
│   ├── Section header
│   └── 3 control cards
│       ├── Camera Controls
│       ├── Keyframes
│       └── References
│
├── Style Section
│   ├── Section header
│   ├── Description
│   └── Large video showcase
│
├── Elements Section
│   ├── Section header
│   └── 3 element cards
│       ├── Character Consistency
│       ├── Variations
│       └── Team Collaboration
│
├── Production Tools
│   └── 3-column feature grid
│
├── Benefits Section
│   └── Expandable hover cards (4 cards)
│
├── Video Gallery
│   └── Vertical marquee (3 columns)
│
├── Testimonials
│   └── Carousel with quotes
│
├── Stats & Reviews
│   ├── User count
│   ├── G2 rating
│   └── Client logos
│
├── FAQ Section
│   └── Accordion (8-10 questions)
│
└── Footer
    ├── Multi-column links
    ├── Social links
    └── Legal links
```

---

## Key Animations

### 1. Scroll-Triggered Staircase
```tsx
// Cards appear sequentially with vertical offset
const y = baseOffset + index * stepOffset
ScrollTrigger.create({
  trigger: card,
  start: "top 80%",
  end: "top 20%",
  scrub: true,
  animation: gsap.from(card, { y, opacity: 0 })
})
```

### 2. Video Play on Hover
```tsx
// Desktop: hover to play
// Mobile: intersection observer
<video
  ref={videoRef}
  onMouseEnter={() => videoRef.current?.play()}
  onMouseLeave={() => videoRef.current?.pause()}
/>
```

### 3. Expandable Cards
```css
.benefit-card {
  grid-template-columns: 1fr;
  transition: grid-template-columns 0.5s;
}

.benefit-card:hover {
  grid-template-columns: 6.2fr;
}

.benefit-card:hover ~ .benefit-card {
  opacity: 0.3;
}
```

### 4. Vertical Marquee
```tsx
<motion.div
  animate={{ y: [0, -1000] }}
  transition={{
    y: {
      repeat: Infinity,
      repeatType: "loop",
      duration: 25,
      ease: "linear"
    }
  }}
>
  {videos.map(v => <VideoCard key={v.id} {...v} />)}
</motion.div>
```

---

## Video Requirements

### Hero Carousel (3 videos)
- `/videos/hero-workflow.mp4` - Workflow demonstration
- `/videos/hero-results.mp4` - Results showcase
- `/videos/hero-features.mp4` - Feature highlights
- **Specs**: 16:9, 1920x1080, MP4, <10MB each
- **Duration**: 10-15 seconds loop

### Feature Cards (7 videos)
- Gen Space: 4 videos (text-to-video, image-to-video, etc.)
- Control: 3 videos (camera, keyframes, references)
- **Specs**: 16:9, 1280x720, MP4, <5MB each
- **Duration**: 5-8 seconds loop

### Style Section (1 video)
- Large showcase video
- **Specs**: 16:9, 1920x1080, MP4, <15MB
- **Duration**: 10-15 seconds loop

### Gallery Marquee (9 videos)
- Vertical videos for infinite scroll
- **Specs**: 9:16, 1080x1920, MP4, <5MB each
- **Duration**: 5-10 seconds loop

**Total**: ~20 videos needed

---

## Typography

### Fonts to Load
```tsx
import { Inter, Montserrat } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
})

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['400', '500', '600', '700'],
  display: 'swap'
})
```

### Type Scale
- Hero H1: `text-6xl md:text-7xl lg:text-8xl`
- Section H2: `text-4xl md:text-5xl lg:text-6xl`
- Feature H3: `text-2xl md:text-3xl`
- Body: `text-base md:text-lg`
- Caption: `text-sm text-[var(--color-ltx-text-dim)]`

---

## Color Usage

### Backgrounds
- Primary: `bg-[var(--color-ltx-navy)]`
- Alternate: `bg-[var(--color-ltx-navy-light)]`
- Gradient banner: `bg-gradient-to-r from-[var(--color-ltx-pink)] to-[var(--color-ltx-purple)]`

### Text
- Heading: `text-[var(--color-ltx-text)]`
- Body: `text-[var(--color-ltx-text-muted)]`
- Muted: `text-[var(--color-ltx-text-dim)]`

### Accents
- Primary CTA: `bg-[var(--color-ltx-blue)] hover:bg-[var(--color-ltx-blue-light)]`
- Borders: `border-white/10`
- Overlays: `bg-black/60`

---

## Responsive Breakpoints

```css
/* Mobile: < 768px */
- Stack all cards vertically
- Single column layouts
- Smaller text sizes
- Touch-friendly hit areas (48px min)

/* Tablet: 768px - 1024px */
- 2-column grids
- Medium text sizes
- Condensed spacing

/* Desktop: > 1024px */
- Full layouts (2x2, 3-column, etc.)
- Hover effects enabled
- Larger text sizes
- Generous spacing
```

---

## Performance Optimizations

### Video Loading
1. **Lazy Load**: Use `loading="lazy"` on non-hero videos
2. **Poster Images**: Provide poster for all videos
3. **Preconnect**: Add `<link rel="preconnect">` for video CDN
4. **Intersection Observer**: Only play videos when visible
5. **Pause on Exit**: Pause videos when out of viewport

### Animation Performance
1. **will-change**: Add to animated elements
2. **transform**: Use `transform` instead of `top/left`
3. **GPU Acceleration**: Use `translate3d()` for smooth animations
4. **Debounce**: Debounce scroll events
5. **RAF**: Use `requestAnimationFrame` for smooth loops

### Code Splitting
1. **Dynamic Imports**: Lazy load non-critical components
2. **Route-based**: Split marketing vs app bundles
3. **Component-based**: Lazy load below-fold sections

---

## Testing Checklist

### Functionality
- [ ] All videos play/pause correctly
- [ ] Tabs switch on click
- [ ] Auto-rotation works (15s interval)
- [ ] Hover effects work on desktop
- [ ] Touch interactions work on mobile
- [ ] Smooth scroll feels natural
- [ ] Links navigate correctly
- [ ] Forms submit properly

### Performance
- [ ] Lighthouse score > 90
- [ ] FCP < 1.8s
- [ ] LCP < 2.5s
- [ ] CLS < 0.1
- [ ] No layout shift on load
- [ ] Videos don't block rendering
- [ ] Smooth 60fps scrolling

### Accessibility
- [ ] WCAG 2.1 AA compliant
- [ ] Keyboard navigation works
- [ ] Screen reader friendly
- [ ] Color contrast meets 4.5:1
- [ ] Focus indicators visible
- [ ] Alt text on all media
- [ ] ARIA labels present

### Cross-Browser
- [ ] Chrome/Edge latest
- [ ] Firefox latest
- [ ] Safari latest (Mac/iOS)
- [ ] Mobile browsers (iOS/Android)

### Responsive
- [ ] Mobile (375px, 414px)
- [ ] Tablet (768px, 1024px)
- [ ] Desktop (1280px, 1440px, 1920px)
- [ ] Ultra-wide (2560px+)

---

## Next Steps

1. **Stop dev server** - Clean build needed
2. **Implement Phase 1** - Infrastructure setup
3. **Build Hero** - Most impactful section
4. **Add Features** - Core content sections
5. **Polish** - Animations, effects, refinement
6. **Test** - Cross-browser, performance, accessibility
7. **Deploy** - Production ready

---

## Notes

- This is a comprehensive redesign - plan for 4-6 hours
- Focus on phases sequentially for best results
- Test frequently on mobile during development
- Prioritize performance over effects
- Keep accessibility in mind from the start
- Use existing LazyVideo component where possible

**Ready to begin?** Let's start with Phase 1: Infrastructure setup.
