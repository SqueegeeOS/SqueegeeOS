"use client";

import { useEffect, useRef, useState } from "react";

export function useInViewAnimation(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [ratio, setRatio] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        setRatio(entry.intersectionRatio);
      },
      { threshold: Array.from({ length: 20 }, (_, i) => i / 20) },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView, ratio };
}
