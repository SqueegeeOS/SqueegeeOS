import {
  isCloudPersistenceConnected,
  PERSISTENCE_UI_COPY,
} from "@/lib/persistence/config";

type LocalStorageNoticeVariant = "badge" | "banner" | "inline" | "cloud";

interface LocalStorageNoticeProps {
  variant?: LocalStorageNoticeVariant;
  className?: string;
}

export function LocalStorageNotice({
  variant = "badge",
  className = "",
}: LocalStorageNoticeProps) {
  if (isCloudPersistenceConnected()) {
    if (variant === "cloud" || variant === "badge") {
      return (
        <span
          className={`inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-300/90 ${className}`}
        >
          {PERSISTENCE_UI_COPY.cloudBadge}
        </span>
      );
    }
    return null;
  }

  if (variant === "banner") {
    return (
      <div
        className={`border-b border-amber-500/20 bg-amber-500/5 px-4 py-2 sm:px-6 ${className}`}
      >
        <p className="text-center text-[10px] uppercase tracking-[0.2em] text-amber-300/90 sm:text-left">
          {PERSISTENCE_UI_COPY.localBadge} — {PERSISTENCE_UI_COPY.localNotice}
        </p>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <p className={`text-xs leading-relaxed text-muted ${className}`}>
        {PERSISTENCE_UI_COPY.localNotice}
      </p>
    );
  }

  return (
    <span
      className={`inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-amber-300/90 ${className}`}
    >
      {PERSISTENCE_UI_COPY.localBadge}
    </span>
  );
}

export function LocalStorageFallbackNotice({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-300/80 ${className}`}
    >
      {PERSISTENCE_UI_COPY.localFallback}
    </span>
  );
}
