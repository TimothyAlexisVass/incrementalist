import { InteractionState, pointInRect } from '../managers/interactions';
import { getActiveWebGLRenderer } from "../../renderer/webgl";
import { queueTooltip } from "./tooltip";

import { BONUSTIME_HUGE_BUTTON_FONT } from "../../config";
import { COLORS } from "../../colors";

const BONUS_TEXT = 'BONUSTIME';
const HUE_ROTATION_MS = 800;

// Pixel-perfect widths for BONUSTIME_BUTTON_FONT
const CHAR_WIDTHS: Record<string, number> = {
  'B': 28, 'O': 32, 'N': 29, 'U': 29, 'S': 26, 'T': 25, 'I': 12, 'M': 37, 'E': 26
};
const TOTAL_WIDTH = Object.values(CHAR_WIDTHS).reduce((a, b) => a + b, 0);

export function doBonusTimeButton(
  input: InteractionState,
  rect: { x: number; y: number; width: number; height: number },
  hasToken: boolean,
  tooltip?: string | string[],
  textUpdateKey?: string
): boolean {
  const isHovered = pointInRect(input.pointer, rect);
  const startedInside = pointInRect(input.pressStartPointer, rect);
  let clicked = false;

  if (isHovered && startedInside && input.clicked && !input.consumed) {
    clicked = true;
    input.consumed = true;
  }

  if (isHovered && tooltip) {
    queueTooltip(input.pointer!, tooltip, {
      widthMode: 'estimated',
      estimatedWidthFactor: 0.52,
      textUpdateKey
    });
  }

  drawBonusTimeButton(rect, hasToken, isHovered);

  return clicked;
}

function drawBonusTimeButton(
  rect: { x: number; y: number; width: number; height: number },
  hasToken: boolean,
  isHovered: boolean
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const now = performance.now();
  const textX = rect.x + (rect.width / 2);
  const textY = rect.y + (rect.height / 2);

  if (!hasToken) {
    renderer.drawText({
      text: BONUS_TEXT,
      x: textX,
      y: textY,
      font: BONUSTIME_HUGE_BUTTON_FONT,
      color: isHovered ? COLORS.button.bonusTime.textActive : COLORS.button.bonusTime.textDisabled,
      align: 'center',
      baseline: 'middle'
    });
    return;
  }

  const hueShift = ((now % HUE_ROTATION_MS) / HUE_ROTATION_MS) * 360;
  const pulse = Math.sin(now / 400) * 0.5 + 0.5;

  // 2. Per-letter rainbow — color is a material uniform so the Troika mesh
  //    is reused across color changes without needing a re-sync.
  const font = BONUSTIME_HUGE_BUTTON_FONT;
  let currentX = textX - (TOTAL_WIDTH / 2);
  const chars = BONUS_TEXT.split('');

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const width = CHAR_WIDTHS[char] || 15;
    const normalized = i / Math.max(1, chars.length - 1);
    const hue = (normalized * 300 + hueShift) % 360;

    // Use raw hue for perfectly smooth transitions. Since color is no longer
    // part of the Troika cache key, this doesn't cause any performance issues.
    const color = `rgb(${hslToRgb(hue, 95, isHovered ? 85 : 75).join(',')})`;

    renderer.drawText({
      text: char,
      x: currentX + width / 2,
      y: textY,
      font,
      color,
      align: 'center',
      baseline: 'middle'
    });

    currentX += width;
  }
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
