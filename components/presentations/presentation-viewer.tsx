"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SlideRenderer } from "./slide-renderer";
import { SigningOverlay } from "./signing-overlay";
import { getPresentationSlides, type PresentationData } from "@/lib/presentations/types";

export function PresentationViewer({
  presentation,
}: {
  presentation: PresentationData;
}) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [signing, setSigning] = useState(false);
  const [signingTier, setSigningTier] = useState<PresentationData["tier"]>("quarterly");
  const slides = getPresentationSlides(presentation);
  const totalSlides = slides.length;
  const currentSlide = slides[currentIndex] ?? slides[0];

  const next = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, totalSlides - 1));
  }, [totalSlides]);

  const prev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (signing) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      }
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") {
        router.push(`/presentations/${presentation.id}/edit`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, presentation.id, router, signing]);

  useEffect(() => {
    if (currentIndex > 0 && presentation.status === "draft") {
      void fetch(`/api/presentations/${presentation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "presented" }),
      });
    }
  }, [currentIndex, presentation.id, presentation.status]);

  if (!currentSlide) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#060606] text-[#f5f2eb]">
        <p className="text-sm text-white/50">No slides available for this presentation.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#060606] text-[#f5f2eb]">
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
        <SlideRenderer
          slideType={currentSlide.id}
          presentation={presentation}
          overrides={presentation.slideOverrides?.[currentSlide.id]}
          onSign={(tier) => {
            setSigningTier(tier);
            setSigning(true);
          }}
        />
      </div>

      <footer className="flex h-[60px] items-center justify-between border-t border-white/10 bg-[#060606]/95 px-6 sm:px-8">
        <span className="text-[11px] tracking-widest text-white/30">
          {String(currentIndex + 1).padStart(2, "0")} /{" "}
          {String(totalSlides).padStart(2, "0")}
        </span>

        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentIndex(i)}
              className="h-1.5 rounded-full border-0 p-0 transition-all"
              style={{
                width: i === currentIndex ? 20 : 6,
                background:
                  i === currentIndex
                    ? "rgba(197,168,105,0.8)"
                    : "rgba(255,255,255,0.2)",
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={prev}
            disabled={currentIndex === 0}
            className="h-9 w-9 rounded border border-white/10 bg-white/5 disabled:opacity-30"
          >
            ←
          </button>
          <button
            type="button"
            onClick={next}
            disabled={currentIndex === totalSlides - 1}
            className="h-9 w-9 rounded border border-white/10 bg-white/5 disabled:opacity-30"
          >
            →
          </button>
        </div>
      </footer>

      {signing && (
        <SigningOverlay
          presentation={presentation}
          selectedTier={signingTier}
          onClose={() => setSigning(false)}
          onComplete={() => {
            setSigning(false);
            router.push(`/presentations/${presentation.id}/edit`);
          }}
        />
      )}
    </div>
  );
}
