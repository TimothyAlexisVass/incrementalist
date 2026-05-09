import { COLORS } from "../../colors";
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
  const {
    label = "LOCKED",
    opacity = 0.1,
    criteria
  } = options;

  ctx.save();
  ctx.globalAlpha = opacity;
  drawElement();
  ctx.restore();

  // Draw LOCKED text overlay
  ctx.save();
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  const textX = rect.x + rect.width / 2;
  const textY = rect.y + rect.height / 2;

  // Outline for readability
  ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
  ctx.lineWidth = 3;
  ctx.strokeText(label, textX, textY);

  ctx.fillStyle = COLORS.panel.textPrimary;
  ctx.fillText(label, textX, textY);
  ctx.restore();

  // Handle tooltip for criteria
  if (criteria && pointInRect(input.pointer, rect)) {
    drawTooltip(ctx, canvas, input.pointer, criteria);
  }
}
