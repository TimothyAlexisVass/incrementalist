import { COLORS } from '../../../colors';
import { getActiveWebGLRenderer } from '../../../renderer/webgl';

export function drawAchievementCardPlaceholder(
  rect: { x: number; y: number; width: number; height: number },
  index: number
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  // Background
  renderer.drawRect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: [0.25, 0.2, 0.2, 1.0]
  });

  // Border
  renderer.drawRect({ x: rect.x, y: rect.y, width: rect.width, height: 1, color: [0.5, 0.4, 0.4, 1.0] });
  renderer.drawRect({ x: rect.x, y: rect.y + rect.height - 1, width: rect.width, height: 1, color: [0.5, 0.4, 0.4, 1.0] });
  renderer.drawRect({ x: rect.x, y: rect.y, width: 1, height: rect.height, color: [0.5, 0.4, 0.4, 1.0] });
  renderer.drawRect({ x: rect.x + rect.width - 1, y: rect.y, width: 1, height: rect.height, color: [0.5, 0.4, 0.4, 1.0] });

  // Label
  renderer.drawText({
    text: `Achievement Placeholder #${index}`,
    x: rect.x + 10,
    y: rect.y + rect.height / 2,
    font: '14px Arial',
    color: COLORS.panel.textPrimary,
    align: 'left',
    baseline: 'middle'
  });
}
