import { HeroCarousel } from '@/components/marketing/HeroCarousel';
import { PossibilitiesSection } from '@/components/landing/PossibilitiesSection';
import { CreativeFlowSection } from '@/components/landing/CreativeFlowSection';
import { ImpossibleSection } from '@/components/landing/ImpossibleSection';
import { ShowcaseWall } from '@/components/landing/ShowcaseWall';
import { VisionariesSection } from '@/components/landing/VisionariesSection';
import { LiveStatsSection } from '@/components/landing/LiveStatsSection';
import { EnterMachineSection } from '@/components/landing/EnterMachineSection';

export default function LandingPage() {
  return (
    <>
      {/* Hero - Tabbed Video Carousel */}
      <HeroCarousel />

      {/* The Possibilities - Exploding capabilities grid */}
      <PossibilitiesSection />

      {/* The Creative Flow - Scroll-animated node graph */}
      <CreativeFlowSection />

      {/* Impossible, Now Possible - Full-width video showcases */}
      <ImpossibleSection />

      {/* The Showcase Wall - Vertical marquee gallery */}
      <ShowcaseWall />

      {/* Built for Visionaries - Creator archetypes */}
      <VisionariesSection />

      {/* The Machine Never Sleeps - Live stats */}
      <LiveStatsSection />

      {/* Enter the Machine - Immersive final CTA */}
      <EnterMachineSection />
    </>
  );
}
