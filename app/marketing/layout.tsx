import { MarketingLayout as Layout } from '@/components/marketing/MarketingLayout';
import { SmoothScrollProvider } from '@/components/providers/SmoothScrollProvider';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SmoothScrollProvider>
      <Layout>{children}</Layout>
    </SmoothScrollProvider>
  );
}
