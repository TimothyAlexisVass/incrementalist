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

/**
 * Converts a normalized RGBA tuple to a 0..255 tuple.
 */
export function to255(rgba: RGBA | number[]): [number, number, number, number] {
  return [rgba[0] * 255, rgba[1] * 255, rgba[2] * 255, (rgba[3] ?? 1) * 255];
}

export function rgbArrayToCss(rgb: number[] | readonly number[]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export function rgbaArrayToCss(rgb: number[] | readonly number[], alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clampNumber(alpha, 0, 1)})`;
}
