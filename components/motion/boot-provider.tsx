"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useReducedMotion } from "framer-motion";
import {
  bootLayerDelay,
  HQ_BOOT_DURATION_MS,
  type BootLayerKey,
} from "@/lib/motion/boot-sequence";
import { emitSound } from "@/lib/motion/sound-events";

interface BootContextValue {
  booting: boolean;
  complete: boolean;
  layerDelay: (layer: BootLayerKey, staggerIndex?: number) => number;
}

const BootContext = createContext<BootContextValue | null>(null);

export function BootProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [booting, setBooting] = useState(!reduceMotion);
  const [complete, setComplete] = useState(!!reduceMotion);

  useEffect(() => {
    if (reduceMotion) {
      setBooting(false);
      setComplete(true);
      return;
    }

    setBooting(true);
    setComplete(false);

    const timer = window.setTimeout(() => {
      setBooting(false);
      setComplete(true);
      emitSound("boot.complete");
    }, HQ_BOOT_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [reduceMotion]);

  const layerDelay = useCallback(
    (layer: BootLayerKey, staggerIndex = 0) =>
      bootLayerDelay(layer, staggerIndex, !!reduceMotion),
    [reduceMotion],
  );

  const value = useMemo(
    () => ({ booting, complete, layerDelay }),
    [booting, complete, layerDelay],
  );

  return (
    <BootContext.Provider value={value}>{children}</BootContext.Provider>
  );
}

export function useBoot(): BootContextValue {
  const ctx = useContext(BootContext);
  if (!ctx) {
    return {
      booting: false,
      complete: true,
      layerDelay: (layer, staggerIndex = 0) =>
        bootLayerDelay(layer, staggerIndex, true),
    };
  }
  return ctx;
}

export function useBootLayerDelay(
  layer: BootLayerKey,
  staggerIndex = 0,
): number {
  return useBoot().layerDelay(layer, staggerIndex);
}
