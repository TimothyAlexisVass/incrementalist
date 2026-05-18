import { getActiveWebGLRenderer, RGBA } from "../../../renderer/webgl";
import { hexToRgba, cssToRgba } from "../../../utils";
import { ResourceChecklistData } from "./view-model";
import { ResourceChecklistState, getResourceChecklistState } from "./interactions";
import bonusTimeConfig from "../../../../../shared/requirements/bonustime.json";
import {
  BONUSTIME_CHECKLIST_BASE_BOX_SIZE_PX,
  BONUSTIME_CHECKLIST_BASE_GAP_PX,
  BONUSTIME_CHECKLIST_BASE_HEIGHT_PX,
  BONUSTIME_CHECKLIST_BASE_WIDTH_PX,
  fitRectWithinBonusTimeArea
} from "../layout";

function getTierConfig(tier: number) {
  return (bonusTimeConfig.reward_tiers as any)[`tier_${tier}`];
}

export function renderResourceChecklist(
  data: ResourceChecklistData,
  rect: { x: number; y: number; width: number; height: number }
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const state = getResourceChecklistState();
  const now = performance.now();
  const layout = fitRectWithinBonusTimeArea(
    rect,
    BONUSTIME_CHECKLIST_BASE_WIDTH_PX,
    BONUSTIME_CHECKLIST_BASE_HEIGHT_PX
  );
  const displayedEntryIndex =
    state === ResourceChecklistState.IDLE
      ? data.nextEntryIndex
      : (data.nextEntryIndex + 16) % 17;

  const gridCols = 6;
  const boxSize = BONUSTIME_CHECKLIST_BASE_BOX_SIZE_PX * layout.scale;
  const gap = BONUSTIME_CHECKLIST_BASE_GAP_PX * layout.scale;
  const startX = layout.x;
  const startY = layout.y;
  const labelFontSize = Math.max(12, Math.round(13 * layout.scale));

  // Draw 17 boxes in a 6-column grid
  for (let i = 0; i < 17; i++) {
    const col = i % gridCols;
    const row = Math.floor(i / gridCols);
    const boxX = startX + col * (boxSize + gap);
    const boxY = startY + row * (boxSize + gap);

    const isCompleted = i < displayedEntryIndex;
    const isActive = i === displayedEntryIndex;

    let bgColor: RGBA = [27 / 255, 36 / 255, 53 / 255, 0.72];
    let borderColor: RGBA = [111 / 255, 132 / 255, 166 / 255, 0.3];
    let labelColor = "#718096";

    if (isCompleted) {
      bgColor = [35 / 255, 85 / 255, 64 / 255, 0.72];
      borderColor = hexToRgba("#8ce8b5");
      labelColor = "#a7f3d0";
    } else if (isActive) {
      const pulse = 0.6 + Math.sin(now / 150) * 0.2;
      bgColor = [43 / 255, 93 / 255, 130 / 255, pulse];
      borderColor = hexToRgba("#8ed5ff");
      labelColor = "#edf2f7";

      if (state === ResourceChecklistState.REVEALING) {
        const hue = (now % 1000) / 1000 * 360;
        bgColor = cssToRgba(`hsl(${hue}, 70%, 45%)`);
        borderColor = cssToRgba(`hsl(${hue}, 90%, 65%)`);
      } else if (state === ResourceChecklistState.REVEALED && data.lastTier) {
        const tierColor = getTierConfig(data.lastTier)?.color || "#ffffff";
        bgColor = hexToRgba(tierColor, 0.7);
        borderColor = hexToRgba(tierColor);
      }
    }

    const borderWidth = isActive ? 2 : 1;

    // Draw outer border box
    renderer.drawRect({
      x: boxX, y: boxY, width: boxSize, height: boxSize,
      color: borderColor
    });

    // Draw inner fill box
    renderer.drawRect({
      x: boxX + borderWidth, y: boxY + borderWidth,
      width: boxSize - 2 * borderWidth, height: boxSize - 2 * borderWidth,
      color: bgColor
    });

    renderer.drawText({
      text: (i + 1).toString(),
      x: boxX + boxSize / 2,
      y: boxY + boxSize / 2,
      font: `${labelFontSize}px Arial`,
      color: labelColor,
      align: 'center',
      baseline: 'middle'
    });
  }
}
