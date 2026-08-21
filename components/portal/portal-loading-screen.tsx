"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AtlasMark } from "@/components/theme/atlas-mark";

const PROGRESS_DELAYS = [650, 1500] as const;

export function PortalLoadingScreen() {
  const [step, setStep] = useState(1);

  useEffect(() => {
    const timers = PROGRESS_DELAYS.map((delay, index) =>
      window.setTimeout(() => setStep(index + 2), delay),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return (
    <main
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#050605] text-[#f4eddf]"
      role="status"
      aria-live="polite"
      aria-label={`Preparing your HomeAtlas portal, step ${step} of 3`}
    >
      <Image
        src="/portal/atlas-loading-screen.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="scale-110 object-cover opacity-35 blur-2xl"
        aria-hidden
      />

      <div className="relative h-[100svh] max-h-[177.7vw] w-[56.28svh] max-w-full overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.72)]">
        <Image
          src="/portal/atlas-loading-screen.webp"
          alt=""
          fill
          priority
          sizes="(max-aspect-ratio:941/1672) 100vw, 56.28svh"
          className="object-contain"
          aria-hidden
        />

        <div
          className="absolute left-1/2 top-[46.9%] flex aspect-square w-[27%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#0a0b08]/75 shadow-[0_0_42px_rgba(5,6,5,0.72)] backdrop-blur-[2px] [--accent:#e4b94f] [--foreground:#f4eddf]"
          aria-hidden
        >
          <AtlasMark size={180} className="h-[88%] w-[88%] text-[#f4eddf]" />
        </div>

        <div className="absolute inset-0" aria-hidden>
          {[22.9, 50, 76.9].map((left, index) => {
            const filled = step >= index + 1;
            return (
              <span
                key={left}
                className={`absolute top-[88.37%] aspect-square w-[3.55%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#e0b646] transition duration-500 motion-reduce:transition-none ${
                  filled
                    ? "scale-100 bg-[#f0c85b] shadow-[0_0_0_5px_rgba(224,182,70,0.18),0_0_18px_rgba(240,200,91,0.9)]"
                    : "scale-90 bg-[#0c0d0b]/90"
                }`}
                style={{ left: `${left}%` }}
              />
            );
          })}
        </div>
      </div>

      <span className="sr-only">
        Opening your property timeline, next visit, and home care plan.
      </span>
    </main>
  );
}
