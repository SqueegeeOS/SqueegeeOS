import { loadFont as loadCormorant } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";

/**
 * Same three families as the production app (app/layout.tsx):
 * Cormorant Garamond (serif), Geist (sans), Geist Mono.
 */
const cormorant = loadCormorant("normal", { weights: ["300", "400", "500", "600"] });
const cormorantItalic = loadCormorant("italic", { weights: ["300", "400", "500"] });
const geist = loadGeist("normal", { weights: ["400", "500", "600"] });
const geistMono = loadGeistMono("normal", { weights: ["400", "500"] });

export const FONTS = {
  serif: cormorant.fontFamily,
  serifItalic: cormorantItalic.fontFamily,
  sans: geist.fontFamily,
  mono: geistMono.fontFamily,
} as const;
