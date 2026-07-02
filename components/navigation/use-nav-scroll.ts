"use client";

import { useEffect, useState } from "react";

const DEFAULT_THRESHOLD = 56;

export function useNavScroll(pathname?: string, threshold = DEFAULT_THRESHOLD) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > threshold);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold, pathname]);

  return scrolled;
}
