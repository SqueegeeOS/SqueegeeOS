export default function PortalLoading() {
  return (
    <main
      className="min-h-[100svh] bg-background px-5 pb-16 pt-[max(4rem,env(safe-area-inset-top))] text-foreground sm:px-10"
      aria-label="Opening member portal"
      aria-busy="true"
    >
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center text-center">
          <div
            className="motion-shimmer relative h-3 w-28 overflow-hidden rounded-full bg-surface/60"
            aria-hidden="true"
          />
          <div
            className="motion-shimmer relative mt-8 h-12 w-4/5 max-w-md overflow-hidden rounded-2xl bg-surface/60"
            aria-hidden="true"
          />
          <div
            className="motion-shimmer relative mt-4 h-4 w-2/3 max-w-xs overflow-hidden rounded-full bg-surface/60"
            aria-hidden="true"
          />
        </div>
        <div className="mt-16 space-y-6">
          <div
            className="motion-shimmer relative h-44 overflow-hidden rounded-[2rem] bg-surface/60"
            aria-hidden="true"
          />
          <div
            className="motion-shimmer relative h-64 overflow-hidden rounded-[2rem] bg-surface/60"
            aria-hidden="true"
          />
        </div>
      </div>
      <p className="sr-only">Opening your private member portal…</p>
    </main>
  );
}
