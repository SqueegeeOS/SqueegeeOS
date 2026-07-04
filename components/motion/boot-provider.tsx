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
  bootDurationMs,
  bootLayerDelay,
  type BootLayerKey,
  type MotionProfile,
} from "@/lib/motion/boot-sequence";
import { emitSound } from "@/lib/motion/sound-events";

interface BootContextValue {
  profile: MotionProfile;
  booting: boolean;
  complete: boolean;
  layerDelay: (layer: BootLayerKey, staggerIndex?: number) => number;
}

const BootContext = createContext<BootContextValue | null>(null);

export function BootProvider({
  children,
  profile = "full",
}: {
  children: ReactNode;
  profile?: MotionProfile;
}) {
  const reduceMotion = useReducedMotion();
  const effectiveProfile: MotionProfile = reduceMotion ? "none" : profile;
  const [booting, setBooting] = useState(effectiveProfile !== "none");
  const [complete, setComplete] = useState(effectiveProfile === "none");

  useEffect(() => {
    if (effectiveProfile === "none") {
      setBooting(false);
      setComplete(true);
      return;
    }

    setBooting(true);
    setComplete(false);

    const duration = bootDurationMs(effectiveProfile);
    const timer = window.setTimeout(() => {
      setBooting(false);
      setComplete(true);
      if (effectiveProfile === "full") {
        emitSound("boot.complete");
      }
    }, duration);

    return () => window.clearTimeout(timer);
  }, [effectiveProfile]);

  const layerDelay = useCallback(
    (layer: BootLayerKey, staggerIndex = 0) =>
      bootLayerDelay(layer, staggerIndex, effectiveProfile),
    [effectiveProfile],
  );

  const value = useMemo(
    () => ({
      profile: effectiveProfile,
      booting,
      complete,
      layerDelay,
    }),
    [booting, complete, effectiveProfile, layerDelay],
  );

  return (
    <BootContext.Provider value={value}>{children}</BootContext.Provider>
  );
}

export function useBoot(): BootContextValue {
  const ctx = useContext(BootContext);
  if (!ctx) {
    return {
      profile: "none",
      booting: false,
      complete: true,
      layerDelay: () => 0,
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
