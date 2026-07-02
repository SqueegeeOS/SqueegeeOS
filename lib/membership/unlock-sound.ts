/** Subtle metallic click — Web Audio, no external asset required */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export function playLockClickSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);

    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = "square";
    click.frequency.setValueAtTime(3200, now + 0.02);
    clickGain.gain.setValueAtTime(0.0001, now + 0.02);
    clickGain.gain.exponentialRampToValueAtTime(0.04, now + 0.025);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    click.connect(clickGain);
    clickGain.connect(ctx.destination);
    click.start(now + 0.02);
    click.stop(now + 0.08);
  } catch {
    // Audio optional — never block the sequence
  }
}
