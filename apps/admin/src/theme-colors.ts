// Theme colours exactly as the public site derives them (apps/web/src/utils/mc-utils.ts):
// the stored hue becomes an HCT seed with fixed chroma/tone, and the chosen palette style
// and spec turn that seed into the Material 3 scheme. Only the hue is stored.
import {
  argbFromHex,
  Hct,
  hexFromArgb,
  SchemeContent,
  SchemeExpressive,
  SchemeFidelity,
  SchemeFruitSalad,
  SchemeMonochrome,
  SchemeNeutral,
  SchemeRainbow,
  SchemeTonalSpot,
  SchemeVibrant,
  type DynamicScheme,
} from "@material/material-color-utilities";

export type ThemeStyle =
  | "tonalSpot"
  | "vibrant"
  | "content"
  | "expressive"
  | "rainbow"
  | "fruitSalad"
  | "monochrome"
  | "neutral"
  | "fidelity";
export type ThemeSpec = "2021" | "2025";

// Must match SEED_CHROMA / SEED_TONE in the public site's mc-utils.ts.
const SEED_CHROMA = 60;
const SEED_TONE = 50;

export function normalizeHue(hue: number) {
  return ((Math.round(hue) % 360) + 360) % 360;
}

/** The seed colour the public site builds from a hue. */
export function seedHex(hue: number) {
  return hexFromArgb(Hct.from(normalizeHue(hue), SEED_CHROMA, SEED_TONE).toInt());
}

/** Hue of any picked colour; its chroma and tone are discarded like on the site. */
export function hueFromHex(hex: string) {
  const value = hex.startsWith("#") ? hex : `#${hex}`;
  return normalizeHue(Hct.fromInt(argbFromHex(value)).hue);
}

function scheme(hue: number, style: ThemeStyle, spec: ThemeSpec, dark: boolean): DynamicScheme {
  const seed = Hct.from(normalizeHue(hue), SEED_CHROMA, SEED_TONE);
  const Scheme = {
    content: SchemeContent,
    expressive: SchemeExpressive,
    fidelity: SchemeFidelity,
    fruitSalad: SchemeFruitSalad,
    monochrome: SchemeMonochrome,
    neutral: SchemeNeutral,
    rainbow: SchemeRainbow,
    vibrant: SchemeVibrant,
    tonalSpot: SchemeTonalSpot,
  }[style] ?? SchemeTonalSpot;
  return new Scheme(seed, dark, 0, spec);
}

export interface ThemeSwatches {
  primary: string;
  secondary: string;
  tertiary: string;
  primaryContainer: string;
  surface: string;
}

/** Key roles of the scheme the site will render for these settings. */
export function themeSwatches(hue: number, style: ThemeStyle, spec: ThemeSpec, dark = false): ThemeSwatches {
  const resolved = scheme(hue, style, spec, dark);
  return {
    primary: hexFromArgb(resolved.primary),
    secondary: hexFromArgb(resolved.secondary),
    tertiary: hexFromArgb(resolved.tertiary),
    primaryContainer: hexFromArgb(resolved.primaryContainer),
    surface: hexFromArgb(resolved.surfaceContainer),
  };
}
