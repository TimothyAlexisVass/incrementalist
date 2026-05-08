import { COLORS } from '../../../colors';
import { Rect } from '../tab-menu/tab-menu';

export function drawLazyLoader(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  message: string = 'Loading...'
) {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const time = Date.now() / 1000;

  ctx.save();

  // Draw rotating outer ring
  ctx.beginPath();
  ctx.arc(centerX, centerY - 20, 24, time * 4, time * 4 + Math.PI * 1.6);
  ctx.strokeStyle = COLORS.panel.textPrimary;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Draw pulsing inner core
  const pulse = Math.sin(time * 6) * 0.2 + 0.8;
  ctx.beginPath();
  ctx.arc(centerX, centerY - 20, 12, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.sisu.blue || '#1E90FF';
  ctx.globalAlpha = pulse;
  ctx.fill();

  // Draw message
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = COLORS.panel.textPrimary;
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, centerX, centerY + 30);

  ctx.restore();
}
