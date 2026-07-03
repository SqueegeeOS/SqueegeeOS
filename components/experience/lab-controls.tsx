"use client";

interface LabControlsProps {
  onPlay?: () => void;
  onPlayFast?: () => void;
  onReplay?: () => void;
  onSkip?: () => void;
  playing?: boolean;
  playLabel?: string;
  playFastLabel?: string;
}

export function LabControls({
  onPlay,
  onPlayFast,
  onReplay,
  onSkip,
  playing = false,
  playLabel = "Play",
  playFastLabel = "Play fast",
}: LabControlsProps) {
  const buttonClass =
    "min-h-[48px] rounded-full border px-5 py-3 text-[10px] uppercase tracking-[0.18em] touch-manipulation transition-colors";

  return (
    <div className="flex flex-wrap gap-3">
      {onPlay && !playing && (
        <button
          type="button"
          onClick={onPlay}
          className={`${buttonClass} border-accent/30 bg-accent/[0.1] text-accent hover:bg-accent/[0.14]`}
        >
          {playLabel}
        </button>
      )}
      {onPlayFast && !playing && (
        <button
          type="button"
          onClick={onPlayFast}
          className={`${buttonClass} border-border text-foreground hover:border-accent/25`}
        >
          {playFastLabel}
        </button>
      )}
      {onReplay && !playing && (
        <button
          type="button"
          onClick={onReplay}
          className={`${buttonClass} border-border text-muted hover:border-accent/25 hover:text-accent`}
        >
          Replay
        </button>
      )}
      {onSkip && playing && (
        <button
          type="button"
          onClick={onSkip}
          className={`${buttonClass} border-border text-muted hover:border-accent/25 hover:text-accent`}
        >
          Skip
        </button>
      )}
    </div>
  );
}
