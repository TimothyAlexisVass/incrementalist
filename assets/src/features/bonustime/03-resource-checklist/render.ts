import { getActiveWebGLRenderer, RGBA } from "../../../renderer/webgl";
import { hexToRgba, cssToRgba } from "../../../utils";
import { ResourceChecklistData } from "./view-model";
import { ResourceChecklistState, getResourceChecklistState } from "./interactions";
import { MODAL_TITLE_FONT, MODAL_BODY_FONT } from "../../../config";
import bonusTimeConfig from "../../../../../shared/requirements/bonustime.json";

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
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const displayedEntryIndex =
    state === ResourceChecklistState.IDLE
      ? data.nextEntryIndex
      : (data.nextEntryIndex + 16) % 17;

  // Title
  renderer.drawText({
    text: "RESOURCE CHECKLIST",
    x: centerX,
    y: rect.y + 40,
    font: MODAL_TITLE_FONT,
    color: "#edf2f7",
    align: 'center',
    baseline: 'middle'
  });

  const gridCols = 6;
  const boxSize = 48;
  const gap = 10;
  const gridWidth = gridCols * boxSize + (gridCols - 1) * gap;
  const gridHeight = 3 * boxSize + 2 * gap;

  const startX = centerX - gridWidth / 2;
  const startY = centerY - gridHeight / 2 + 10;

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
      font: MODAL_BODY_FONT,
      color: labelColor,
      align: 'center',
      baseline: 'middle'
    });
  }

  // Bottom instruction label
  let instruction = "";
  if (state === ResourceChecklistState.IDLE) {
    instruction = data.hasToken ? "CLICK ANYWHERE TO CHECK OFF" : "NO TOKENS AVAILABLE";
  } else if (state === ResourceChecklistState.REVEALING) {
    instruction = "CHECKING OFF...";
  } else if (state === ResourceChecklistState.REVEALED) {
    instruction = "CLICK TO CLAIM REWARD";
  }

  renderer.drawText({
    text: instruction,
    x: centerX,
    y: startY + gridHeight + 35,
    font: MODAL_BODY_FONT,
    color: "#a0aec0",
    align: 'center',
    baseline: 'middle'
  });
}
