interface AdminEmptySalesStateProps {
  variant?: "default" | "filtered";
}

export function AdminEmptySalesState({
  variant = "default",
}: AdminEmptySalesStateProps) {
  if (variant === "filtered") {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-gradient-to-b from-surface/30 to-background/20 px-6 py-10 text-center sm:px-10">
        <p className="font-serif text-xl font-light text-foreground sm:text-2xl">
          No closed jobs in this period
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
          Widen the date filter or log a new sale to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-gradient-to-b from-surface/30 to-background/20 px-6 py-10 text-center sm:px-10">
      <p className="font-serif text-xl font-light text-foreground sm:text-2xl">
        No closed jobs logged yet.
      </p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
        Log your first completed sale to begin building your sales history.
      </p>
    </div>
  );
}
