"use client";

import ReactDOM from "react-dom";

const ARTWORK_PATH = "/brand/homeatlas-member-loader-v1.webp";

export function PreloadPortalLoadingArtwork() {
  ReactDOM.preload(ARTWORK_PATH, {
    as: "image",
    type: "image/webp",
    fetchPriority: "high",
  });

  return null;
}
