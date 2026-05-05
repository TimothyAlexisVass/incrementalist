import { colors } from "../../theme/colors";
import type { ServerState } from "../../net/snapshots";

export type CanvasState = {
  width: number;
  height: number;
  pixelRatio: number;
};

export function resizeCanvas(canvas: HTMLCanvasElement, state: CanvasState) {
  // The canvas covers the viewport, so unbounded devicePixelRatio can multiply
  // memory and fill cost without making this UI meaningfully clearer.
  state.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  canvas.width = Math.floor(state.width * state.pixelRatio);
  canvas.height = Math.floor(state.height * state.pixelRatio);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;

  const context = canvas.getContext("2d");
  if (context) context.setTransform(state.pixelRatio, 0, 0, state.pixelRatio, 0, 0);
}

export function renderHudCanvas(
  context: CanvasRenderingContext2D,
  canvasState: CanvasState,
  serverState: ServerState,
  time: number
) {
  const { width, height } = canvasState;
  const snapshot = serverState.snapshot;

  context.fillStyle = colors.background;
  context.fillRect(0, 0, width, height);
  context.fillStyle = colors.sky;
  context.fillRect(0, 0, width, Math.max(180, height * 0.4));

  context.fillStyle = colors.grass;
  context.beginPath();
  context.moveTo(0, height * 0.58);
  context.bezierCurveTo(width * 0.18, height * 0.47, width * 0.56, height * 0.66, width, height * 0.5);
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
  context.fill();

  const centerX = width < 720 ? width * 0.5 : width * 0.68;
  const centerY = Math.max(150, height * 0.38 + Math.sin(time / 600) * 4);

  context.fillStyle = "rgba(22, 32, 38, 0.15)";
  context.beginPath();
  context.ellipse(centerX, centerY + 95, 150, 24, 0, 0, Math.PI * 2);
  context.fill();

  roundRect(context, centerX - 140, centerY - 52, 280, 128, 8);
  context.fillStyle = colors.ink;
  context.fill();

  roundRect(context, centerX - 106, centerY - 86, 212, 92, 8);
  context.fillStyle = colors.blue;
  context.fill();

  roundRect(context, centerX - 76, centerY - 58, 152, 42, 6);
  context.fillStyle = colors.panelStrong;
  context.fill();

  context.fillStyle = colors.ink;
  context.font = "800 22px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(`Level ${snapshot?.state.level ?? 1}`, centerX, centerY - 37);

  context.fillStyle = colors.gold;
  // This is display-only fill from the latest server snapshot. Reaching full on
  // the client must not grant anything; collectibility requires a command result.
  const progress = snapshot?.state.progress_bar.fill ?? 0;
  roundRect(context, centerX - 86, centerY + 26, 172, 18, 5);
  context.strokeStyle = "rgba(255,255,255,0.8)";
  context.lineWidth = 2;
  context.stroke();
  context.fillRect(centerX - 84, centerY + 28, Math.max(0, Math.min(168, progress * 1.68)), 14);

  if (serverState.loadingMessage) {
    context.fillStyle = "rgba(22, 32, 38, 0.58)";
    context.fillRect(0, 0, width, height);
    context.fillStyle = colors.panelStrong;
    context.font = "850 24px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(serverState.loadingMessage, width / 2, height / 2);
  }
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}
