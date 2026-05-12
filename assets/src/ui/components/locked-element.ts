import { COLORS } from "../../colors";
import { getActiveWebGLRenderer } from "../../renderer/webgl";
import { InteractionState, pointInRect } from "../managers/interactions";
import { drawTooltip } from "./tooltip";

export interface LockedElementOptions {
  label?: string;
  opacity?: number;
  criteria?: string | string[];
  font?: string;
  showNotice?: boolean;
  showNoticePing?: boolean;
}

export function drawLockedElement(
  canvas: HTMLCanvasElement,
  input: InteractionState,
  rect: { x: number; y: number; width: number; height: number },
  drawElement: () => void,
  options: LockedElementOptions = {}
) {
  const renderer = getActiveWebGLRenderer();

  const {
    label = "LOCKED",
    opacity = 0.1,
    criteria,
    font = "bold 12px Arial",
    showNotice = false,
    showNoticePing = false
  } = options;

  drawElement();
  renderer.drawRect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: [0, 0, 0, opacity]
  });

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
    const noticeRadius = 4;
    const textWidth = renderer.measureTextWidth({ text: label, font });
    const noticeX = textX + textWidth / 2 + noticeRadius + 2;
    const noticeY = textY - 8;
    
    renderer.drawRect({
      x: noticeX - noticeRadius,
      y: noticeY - noticeRadius,
      width: noticeRadius * 2,
      height: noticeRadius * 2,
      color: [1, 0, 0, 1]
    });

    if (showNoticePing) {
      const time = Date.now() / 1000;
      const pulse = Math.sin(time * 10) * 0.5 + 0.5;
      renderer.drawRect({
        x: noticeX - noticeRadius - 2,
        y: noticeY - noticeRadius - 2,
        width: noticeRadius * 2 + 4,
        height: noticeRadius * 2 + 4,
        color: [1, 0, 0, 0.2 * pulse]
      });
    }
  }

  if (criteria && input.pointer && pointInRect(input.pointer, rect)) {
    drawTooltip(canvas, input.pointer, criteria);
  }
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
