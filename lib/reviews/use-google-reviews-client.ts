"use client";

import { useEffect, useState } from "react";
import type { GoogleReviewsApiResponse } from "./types";

interface UseGoogleReviewsResult {
  response: GoogleReviewsApiResponse | null;
  loading: boolean;
}

export function useGoogleReviewsClient(): UseGoogleReviewsResult {
  const [response, setResponse] = useState<GoogleReviewsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/reviews/google");
        if (!res.ok) throw new Error("Failed to load reviews");
        const json = (await res.json()) as GoogleReviewsApiResponse;
        if (!cancelled) setResponse(json);
      } catch {
        if (!cancelled) {
          setResponse({
            status: "unavailable",
            data: null,
            message: "Google reviews temporarily unavailable.",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { response, loading };
}
