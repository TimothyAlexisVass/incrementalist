import { COLORS } from "../../colors";
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
    const noticeX = rect.x + rect.width + 2;
    const noticeY = rect.y - 2;
    
    drawNoticeDot(noticeX, noticeY, 4, showNoticePing);
  }

  if (criteria && input.pointer && pointInRect(input.pointer, rect)) {
    drawTooltip(canvas, input.pointer, criteria);
  }
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
