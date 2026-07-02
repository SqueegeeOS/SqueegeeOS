export function AmbientGlow({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
    >
      <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-accent/[0.04] blur-[140px]" />
      <div className="absolute bottom-0 right-0 h-[500px] w-[500px] translate-x-1/4 rounded-full bg-white/[0.015] blur-[120px]" />
    </div>
  );
}
