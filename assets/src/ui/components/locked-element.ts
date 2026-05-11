import { COLORS } from "../../colors";
import { getActiveWebGLRenderer } from "../../renderer/webgl";
import { InteractionState, pointInRect } from "../managers/interactions";
import { drawTooltip } from "./tooltip";

export interface LockedElementOptions {
  label?: string;
  opacity?: number;
  criteria?: string | string[];
}

export function drawLockedElement(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  input: InteractionState,
  rect: { x: number; y: number; width: number; height: number },
  drawElement: () => void,
  options: LockedElementOptions = {}
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) {
    return;
  }

  const {
    label = "LOCKED",
    opacity = 0.1,
    criteria
  } = options;

  drawElement();
  renderer.drawRect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: [0, 0, 0, clamp01((1 - opacity) * 0.55)]
  });

  const textX = rect.x + rect.width / 2;
  const textY = rect.y + rect.height / 2;

  renderer.drawText({
    text: label,
    x: textX,
    y: textY,
    font: "bold 12px Arial",
    color: COLORS.panel.textPrimary,
    align: "center",
    baseline: "middle",
    strokeColor: "rgba(0, 0, 0, 0.8)",
    strokeWidth: 3
  });

  if (criteria && input.pointer && pointInRect(input.pointer, rect)) {
    drawTooltip(ctx, canvas, input.pointer, criteria);
  }
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
