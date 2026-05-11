import { clampNumber } from './math';
import { getActiveWebGLRenderer } from '../renderer/webgl';

export const LOCKED_ELEMENT_OPACITY = 0.1;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LockedDrawOptions {
  opacity?: number;
  label?: string;
  font?: string;
  textColor?: string;
  outlineColor?: string;
  outlineWidth?: number;
  textX?: number;
  textY?: number;
  showNotice?: boolean;
  showNoticePing?: boolean;
}



function estimateFontAscent(font: string): number {
  const match = /(\d+(?:\.\d+)?)px/i.exec(font);
  const px = match ? Number.parseFloat(match[1]) : 12;
  return px * 0.8;
}
