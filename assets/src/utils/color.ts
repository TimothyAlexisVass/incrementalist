import { clampNumber, lerp } from './math';

export function lerpColor(c1: number[] | readonly number[], c2: number[] | readonly number[], t: number): [number, number, number] {
  return [
    Math.floor(lerp(c1[0], c2[0], t)),
    Math.floor(lerp(c1[1], c2[1], t)),
    Math.floor(lerp(c1[2], c2[2], t))
  ];
}

export function hexToRgbArray(color: string | number[] | readonly number[]): [number, number, number] {
  if (Array.isArray(color)) {
    return [color[0], color[1], color[2]];
  }

  if (typeof color !== 'string') {
    return [0, 0, 0];
  }

  const hex = color.trim().replace(/^#/, '');
  const expanded = hex.length === 3
    ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    : hex;
  const value = Number.parseInt(expanded, 16);

  if (!Number.isFinite(value)) {
    return [0, 0, 0];
  }

  return [
    (value >> 16) & 255,
    (value >> 8) & 255,
    value & 255
  ];
}

export function rgbArrayToCss(rgb: number[] | readonly number[]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export function rgbaArrayToCss(rgb: number[] | readonly number[], alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clampNumber(alpha, 0, 1)})`;
}
