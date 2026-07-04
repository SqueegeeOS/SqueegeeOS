"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

function parseNumericValue(value: string): { numeric: number; prefix: string; suffix: string } | null {
  const match = value.match(/^([^0-9\-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/);
  if (!match) return null;
  const numeric = Number.parseFloat(match[2].replace(/,/g, ""));
  if (Number.isNaN(numeric)) return null;
  return { prefix: match[1], suffix: match[3], numeric };
}

function formatNumber(n: number, decimals: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function CountValue({
  value,
  className = "",
  delay = 0,
  duration = 1.4,
}: {
  value: string;
  className?: string;
  delay?: number;
  duration?: number;
}) {
  const reduceMotion = useReducedMotion();
  const parsed = parseNumericValue(value);
  const [display, setDisplay] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    if (reduceMotion || !parsed) {
      setDisplay(value);
      return;
    }

    if (started.current) return;
    started.current = true;

    const decimals = parsed.numeric % 1 !== 0 ? 2 : 0;
    const start = performance.now() + delay * 1000;
    let frame = 0;

    const tick = (now: number) => {
      if (now < start) {
        frame = requestAnimationFrame(tick);
        return;
      }

      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - (1 - progress) ** 3;
      const current = parsed.numeric * eased;
      setDisplay(`${parsed.prefix}${formatNumber(current, decimals)}${parsed.suffix}`);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [delay, duration, parsed, reduceMotion, value]);

  return <span className={className}>{display}</span>;
}
