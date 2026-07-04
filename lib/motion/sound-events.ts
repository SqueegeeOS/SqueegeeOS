/**
 * Sound-ready motion architecture.
 * Animations emit events; audio layer can subscribe without redesign.
 */
export type SoundEvent =
  | "surface.tap"
  | "glass.focus"
  | "glass.tap"
  | "paper.slide"
  | "confirm.chime"
  | "boot.layer"
  | "boot.complete"
  | "data.refresh"
  | "status.pulse";

const SOUND_EVENT_NAME = "homeatlas:sound";

export function emitSound(event: SoundEvent, detail?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SOUND_EVENT_NAME, {
      detail: { event, ...detail, at: Date.now() },
    }),
  );
}

export function onSound(
  handler: (event: SoundEvent, detail: Record<string, unknown>) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const listener = (e: Event) => {
    const custom = e as CustomEvent<{ event: SoundEvent } & Record<string, unknown>>;
    handler(custom.detail.event, custom.detail);
  };

  window.addEventListener(SOUND_EVENT_NAME, listener);
  return () => window.removeEventListener(SOUND_EVENT_NAME, listener);
}
