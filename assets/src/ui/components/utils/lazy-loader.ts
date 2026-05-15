import { COLORS } from '../../../colors';
import { Rect } from '../tab-menu/tab-menu';
import { getActiveWebGLRenderer } from '../../../renderer/webgl';
import { getServerNow } from '../../../core/time';

export function drawLazyLoader(
  rect: Rect,
  message: string = 'Loading...'
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  
  // Use synchronized server time for the animation
  const time = getServerNow() / 1000;

  // Background dimming for the area (optional, but makes it feel more "modal")
  // For a lazy loader, maybe we just want it to be clean.
  
  const spinnerRadius = 24;
  const spinnerThickness = 4;
  const rotationSpeed = 6; // radians per second
  
  // Spinner Segment: a 270-degree arc that spins
  const startAngle = (time * rotationSpeed) % (Math.PI * 2);
  const segmentLength = Math.PI * 1.5;
  const endAngle = startAngle + segmentLength;

  const primaryColor = cssToRgba(COLORS.sisu.azure);
  const textPrimary = COLORS.panel.textPrimary;

  // 1. Draw the spinning arc
  renderer.drawArc(
    centerX, 
    centerY - 20, 
    spinnerRadius, 
    spinnerThickness, 
    startAngle, 
    endAngle, 
    primaryColor,
    0.2 // subtle glow/softness
  );

  // 2. Draw a pulsing center dot
  const pulse = Math.sin(time * 8) * 0.2 + 0.8;
  renderer.drawCircle(
    centerX,
    centerY - 20,
    spinnerRadius * 0.4,
    [primaryColor[0], primaryColor[1], primaryColor[2], primaryColor[3] * pulse],
    0.5 // softer glow for the center
  );

  // 3. Draw the message text
  renderer.drawText({
    text: message,
    x: centerX,
    y: centerY + 30,
    font: 'bold 16px Inter', // Use Inter as defined in webgl.ts
    color: textPrimary,
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

