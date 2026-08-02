"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Defers billable, non-cacheable Places requests until the review section is
 * close enough that a visitor is likely to see it.
 */
export function useNearViewport(rootMargin = "600px") {
  const targetRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || shouldLoad) return;

    if (!("IntersectionObserver" in window)) {
      const fallbackFrame = requestAnimationFrame(() => setShouldLoad(true));
      return () => cancelAnimationFrame(fallbackFrame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [rootMargin, shouldLoad]);

  return { targetRef, shouldLoad };
}
