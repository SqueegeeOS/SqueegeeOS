import {
  Eyebrow,
  Reveal,
  Section,
  SectionTitle,
} from "@/components/home-care-plan/ui/primitives";

export function ReviewsSectionSkeleton() {
  return (
    <Section id="reviews" className="bg-surface/30">
      <div className="text-center">
        <Eyebrow>Reviews</Eyebrow>
        <SectionTitle className="mx-auto mt-6">Loading Google reviews…</SectionTitle>
        <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-muted">
          Fetching live rating and reviews
        </p>
      </div>

      <div className="mx-auto mt-20 max-w-4xl space-y-16 lg:mt-24 lg:space-y-20">
        {[0, 1].map((index) => (
          <div
            key={index}
            className="animate-pulse space-y-6 text-center"
            aria-hidden
          >
            <div className="mx-auto h-3 w-24 rounded-full bg-border/70" />
            <div className="mx-auto h-24 max-w-2xl rounded-3xl bg-border/40" />
            <div className="mx-auto h-10 w-40 rounded-full bg-border/50" />
          </div>
        ))}
      </div>
    </Section>
  );
}
