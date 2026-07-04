"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

export function TypewriterText({
  text,
  className = "",
  delay = 0,
  charMs = 22,
  onComplete,
}: {
  text: string;
  className?: string;
  delay?: number;
  charMs?: number;
  onComplete?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(reduceMotion ? text.length : 0);

  useEffect(() => {
    if (reduceMotion) {
      setVisible(text.length);
      onComplete?.();
      return;
    }

    setVisible(0);
    let index = 0;
    let interval: number | undefined;
    const startTimer = window.setTimeout(() => {
      interval = window.setInterval(() => {
        index += 1;
        setVisible(index);
        if (index >= text.length) {
          if (interval) window.clearInterval(interval);
          onComplete?.();
        }
      }, charMs);
    }, delay * 1000);

    return () => {
      window.clearTimeout(startTimer);
      if (interval) window.clearInterval(interval);
    };
  }, [charMs, delay, onComplete, reduceMotion, text]);

  return (
    <span className={className}>
      {text.slice(0, visible)}
      {!reduceMotion && visible < text.length && (
        <span className="motion-caret ml-px inline-block w-[2px] animate-pulse bg-accent/70" />
      )}
    </span>
  );
}
