import type {
  AIStatus,
  MembershipStatus,
  PropertyHealthStatus,
} from "@/lib/property/types";

const healthStyles: Record<PropertyHealthStatus, string> = {
  Excellent: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300/90",
  "Well Maintained": "border-accent/25 bg-accent/10 text-accent",
  "Needs Attention": "border-amber-500/25 bg-amber-500/10 text-amber-300/90",
  "Under Review": "border-sky-500/25 bg-sky-500/10 text-sky-300/90",
};

const aiStyles: Record<AIStatus, string> = {
  Active: "text-emerald-400/90",
  Processing: "text-amber-400/90",
  Idle: "text-muted",
};

export function HealthBadge({ status }: { status: PropertyHealthStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] ${healthStyles[status]}`}
    >
      {status}
    </span>
  );
}

export function MembershipBadge({ status }: { status: MembershipStatus }) {
  const isPreferred = status === "Preferred Care" || status === "Estate Care";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] ${
        isPreferred
          ? "border-accent/30 bg-accent/10 text-accent"
          : status === "Inactive"
            ? "border-border bg-surface-elevated text-muted"
            : "border-border bg-surface-elevated text-foreground/70"
      }`}
    >
      {status}
    </span>
  );
}

export function AIIndicator({ status }: { status: AIStatus }) {
  return (
    <span className={`text-[11px] font-medium tracking-[0.12em] ${aiStyles[status]}`}>
      <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      AI {status}
    </span>
  );
}

export function StatCell({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.26em] text-muted">
        {label}
      </p>
      <p
        className={`mt-1.5 font-serif text-xl font-light tracking-tight sm:text-2xl ${
          accent ? "text-accent" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
