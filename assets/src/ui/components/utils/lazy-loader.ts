import { COLORS } from '../../../colors';
import { Rect } from '../tab-menu/tab-menu';
import { getActiveWebGLRenderer } from '../../../renderer/webgl';

export function drawLazyLoader(
  rect: Rect,
  message: string = 'Loading...'
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const time = Date.now() / 1000;

  // WebGL renderer doesn't have an arc/circle primitive yet, 
  // but we can approximate it or use a square for now if we want to be quick.
  // Actually, I'll just use drawRect for the spinner and text for the message.
  
  const size = 32;
  const rotation = time * 4;
  
  renderer.drawRect({
    x: centerX - size / 2,
    y: centerY - 40,
    width: size,
    height: size,
    color: cssToRgba(COLORS.panel.textPrimary)
  });

  const pulse = Math.sin(time * 6) * 0.2 + 0.8;
  renderer.drawRect({
    x: centerX - 8,
    y: centerY - 40 + 8,
    width: 16,
    height: 16,
    color: cssToRgba(COLORS.sisu.azure || '#1E90FF'),
    alpha: pulse
  });

  renderer.drawText({
    text: message,
    x: centerX,
    y: centerY + 30,
    font: 'bold 16px Arial',
    color: COLORS.panel.textPrimary,
    align: 'center',
    baseline: 'middle'
  });
}

function cssToRgba(color: string): [number, number, number, number] {
  const hex = String(color || "").trim().replace(/^#/, "");
  const expanded = hex.length === 3 ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex;
  const parsed = Number.parseInt(expanded, 16);
  if (!Number.isFinite(parsed)) return [1, 1, 1, 1];
  return [((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255, 1];
}
