import React from "react";
import { Composition, Still } from "remotion";
import { DEFAULT_PROPS, Master } from "./Master";
import { Poster } from "./Poster";

const FPS = 30;
const DURATION = 15 * FPS; // 450 frames

const POSTER_PROPS = {
  headline: "Window cleaning with a",
  headlineAccent: "memory.",
  cta: "Get your free Home Care Plan",
  url: "SqueegeeKing.net",
  imageSrc: "footage/hero-house-master.png",
};

export const Root: React.FC = () => (
  <>
    <Composition
      id="master-9x16"
      component={Master}
      durationInFrames={DURATION}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={DEFAULT_PROPS}
    />
    <Composition
      id="feed-4x5"
      component={Master}
      durationInFrames={DURATION}
      fps={FPS}
      width={1080}
      height={1350}
      defaultProps={DEFAULT_PROPS}
    />
    <Still id="poster-9x16" component={Poster} width={1080} height={1920} defaultProps={POSTER_PROPS} />
    <Still id="poster-4x5" component={Poster} width={1080} height={1350} defaultProps={POSTER_PROPS} />
  </>
);
