import { clampNumber, lerp } from './math';

/**
 * Normalized RGBA color tuple [r, g, b, a] where each component is 0.0 to 1.0.
 */
export type RGBA = readonly [number, number, number, number];

/**
 * Linearly interpolates between two color tuples.
 * Works for both normalized [0..1] and 0..255 scales.
 */
export function lerpColor(c1: number[] | readonly number[], c2: number[] | readonly number[], t: number): number[] {
  return c1.map((val, i) => lerp(val, c2[i], t));
}

/**
 * Converts a hex color string to a normalized RGBA tuple [0..1].
 */
export function hexToRgba(hex: string, alpha = 1): RGBA {
  const normalized = String(hex || "").trim().replace(/^#/, "");
  const expanded = normalized.length === 3
    ? normalized[0] + normalized[0] + normalized[1] + normalized[1] + normalized[2] + normalized[2]
    : normalized;
    
  const value = parseInt(expanded, 16);
  if (isNaN(value) || (normalized.length !== 3 && normalized.length !== 6)) {
    return [0, 0, 0, alpha];
  }

  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
    clampNumber(alpha, 0, 1)
  ];
}



export function rgbArrayToCss(rgb: number[] | readonly number[]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export function rgbaArrayToCss(rgb: number[] | readonly number[], alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clampNumber(alpha, 0, 1)})`;
}

/**
 * Converts a CSS color string (hex or hsl) to a normalized RGBA tuple [0..1].
 */
export function cssToRgba(css: string): RGBA {
  const normalized = String(css || "").trim().toLowerCase();
  
  if (normalized.startsWith("#")) {
    return hexToRgba(normalized);
  }

  if (normalized.startsWith("hsl")) {
    const matches = normalized.match(/hsl\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
    if (matches) {
      const h = parseFloat(matches[1]);
      const s = parseFloat(matches[2]) / 100;
      const l = parseFloat(matches[3]) / 100;
      return hslToRgb(h, s, l);
    }
  }

  return [1, 1, 1, 1];
}

export function hslToRgb(h: number, s: number, l: number, a = 1.0): RGBA {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  return [r + m, g + m, b + m, a];
}
