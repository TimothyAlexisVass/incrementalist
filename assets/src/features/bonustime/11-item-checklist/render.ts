import { getActiveWebGLRenderer, RGBA } from "../../../renderer/webgl";
import { hexToRgba } from "../../../utils";
import { getRewardTierLabelColor } from "../../../colors";
import bonusTimeConfig from "../../../../../shared/requirements/bonustime.json";
import { ItemChecklistData } from "./view-model";
import {
  BONUSTIME_CHECKLIST_GRID_COLS,
  BONUSTIME_CHECKLIST_BASE_BOX_SIZE_PX,
  BONUSTIME_CHECKLIST_BASE_GAP_PX,
  BONUSTIME_CHECKLIST_BASE_HEIGHT_PX,
  BONUSTIME_CHECKLIST_BASE_WIDTH_PX,
  fitRectWithinBonusTimeArea
} from "../layout";

function getTierConfig(tier: number) {
  return (bonusTimeConfig.reward_tiers as any)[`tier_${tier}`];
}

export function renderItemChecklist(
  data: ItemChecklistData,
  rect: { x: number; y: number; width: number; height: number }
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;
  const now = performance.now();

  const layout = fitRectWithinBonusTimeArea(
    rect,
    BONUSTIME_CHECKLIST_BASE_WIDTH_PX,
    BONUSTIME_CHECKLIST_BASE_HEIGHT_PX
  );

  const boxSize = BONUSTIME_CHECKLIST_BASE_BOX_SIZE_PX * layout.scale;
  const gap = BONUSTIME_CHECKLIST_BASE_GAP_PX * layout.scale;
  const startX = layout.x;
  const startY = layout.y;
  const labelFontSize = Math.max(11, Math.round(12 * layout.scale));

  for (const entry of data.entries) {
    const col = entry.entryIndex % BONUSTIME_CHECKLIST_GRID_COLS;
    const row = Math.floor(entry.entryIndex / BONUSTIME_CHECKLIST_GRID_COLS);
    const boxX = startX + col * (boxSize + gap);
    const boxY = startY + row * (boxSize + gap);

    drawChecklistEntry(renderer, boxX, boxY, boxSize, entry, labelFontSize, layout.scale, now);
  }
}

function drawChecklistEntry(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  boxX: number,
  boxY: number,
  boxSize: number,
  entry: ItemChecklistData["entries"][number],
  labelFontSize: number,
  scale: number,
  now: number
) {
  const tierColor = getTierConfig(entry.tier)?.color || "#ffffff";
  const isCompleted = entry.completed;
  const isActive = entry.active;
  const borderThickness = isActive ? 3 : 1;
  const borderAlpha = isActive ? 1 : 0.55;
  const fillAlpha = isActive ? 0.85 + (Math.sin(now / 170) * 0.15) : (isCompleted ? 1 : 0.26);
  const textColor = getRewardTierLabelColor(entry.tier);
  const bgColor: RGBA = [0.106, 0.141, 0.208, 1];
  const borderColor: RGBA = [1, 1, 1, borderAlpha];
  const inset = Math.min(borderThickness, Math.floor(boxSize / 2));
  const innerSize = Math.max(1, boxSize - (2 * inset));

  renderer.drawRect({
    x: boxX,
    y: boxY,
    width: boxSize,
    height: boxSize,
    color: bgColor
  });

  renderer.drawRect({
    x: boxX + inset,
    y: boxY + inset,
    width: innerSize,
    height: innerSize,
    color: hexToRgba(tierColor, fillAlpha)
  });

  drawChecklistBorder(
    renderer,
    boxX,
    boxY,
    boxSize,
    boxSize,
    borderThickness,
    borderColor
  );

  renderer.drawText({
    text: `TIER ${entry.tier}`,
    x: boxX + boxSize / 2,
    y: boxY + boxSize / 2,
    font: `${labelFontSize}px Arial`,
    color: textColor,
    align: 'center',
    baseline: 'middle',
    alpha: 1
  });

  if (isCompleted) {
    renderer.drawText({
      text: "✓",
      x: boxX + boxSize - (2 * scale),
      y: boxY + (0.2 * scale),
      font: `${Math.max(9, Math.round(10 * scale))}px Arial`,
      color: textColor,
      align: 'right',
      baseline: 'top'
    });
  }
}

function drawChecklistBorder(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  x: number,
  y: number,
  width: number,
  height: number,
  borderThickness: number,
  color: RGBA
) {
  const stroke = Math.max(1, borderThickness);
  renderer.drawRect({ x, y, width, height: stroke, color });
  renderer.drawRect({ x, y: y + height - stroke, width, height: stroke, color });
  renderer.drawRect({ x, y, width: stroke, height, color });
  renderer.drawRect({ x: x + width - stroke, y, width: stroke, height, color });
}
