import { COLORS } from "../../colors";
import { withLockedAlpha } from "../../utils/locked";
import { getActiveWebGLRenderer } from "../../renderer/webgl";
import { InteractionState, pointInRect } from "../managers/interactions";
import { drawTooltip } from "./tooltip";
import { drawNoticeDot } from "./button";

export interface LockedElementOptions {
  label?: string;
  opacity?: number;
  criteria?: string | string[];
  font?: string;
  showNotice?: boolean;
  showNoticePing?: boolean;
  shape?: "rect" | "circle";
  padding?: number;
}

export function drawLockedElement(
  canvas: HTMLCanvasElement,
  input: InteractionState,
  rect: { x: number; y: number; width: number; height: number },
  drawElement: () => void,
  options: LockedElementOptions = {}
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const {
    label = "LOCKED",
    opacity = 0.7,
    criteria,
    font = "bold 13px Arial",
    showNotice = false,
    showNoticePing = false,
    shape = "rect",
    padding = 0
  } = options;

  withLockedAlpha(true, opacity, drawElement);
  
  const textX = rect.x + rect.width / 2;
  const textY = rect.y + rect.height / 2;

  renderer.drawText({
    text: label,
    x: textX,
    y: textY,
    font,
    color: COLORS.panel.textPrimary,
    align: "center",
    baseline: "middle",
    strokeColor: "rgba(0, 0, 0, 0.8)",
    strokeWidth: 3
  });

  if (showNotice) {
    const textWidth = renderer.measureTextWidth({ text: label, font });
    const fontSize = parseFontSize(font);

    const noticeX = textX + textWidth / 2 + 6;
    const noticeY = textY - fontSize / 2 - 4;

    drawNoticeDot(noticeX, noticeY, 4, showNoticePing);
  }

  const hitX = rect.x - padding;
  const hitY = rect.y - padding;
  const hitW = rect.width + padding * 2;
  const hitH = rect.height + padding * 2;
  const hitRect = { x: hitX, y: hitY, width: hitW, height: hitH };

  let isHovered = false;
  if (input.pointer) {
    if (shape === "circle") {
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      const radius = Math.max(rect.width, rect.height) / 2 + padding;
      const dx = input.pointer.x - centerX;
      const dy = input.pointer.y - centerY;
      isHovered = dx * dx + dy * dy <= radius * radius;
    } else {
      isHovered = pointInRect(input.pointer, hitRect);
    }
  }

  if (criteria && isHovered) {
    drawTooltip(canvas, input.pointer!, criteria);
  }
}

function parseFontSize(font: string): number {
  const match = /(\d+)px/.exec(font);
  return match ? parseInt(match[1], 10) : 12;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
