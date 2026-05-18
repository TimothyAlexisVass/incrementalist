export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FittedRect extends Rect {
  scale: number;
}

export const BONUSTIME_GAME_PADDING_PX = 50;

export const BONUSTIME_CHECKLIST_GRID_COLS = 6;
export const BONUSTIME_CHECKLIST_GRID_ROWS = 3;
export const BONUSTIME_CHECKLIST_BASE_BOX_SIZE_PX = 48;
export const BONUSTIME_CHECKLIST_BASE_GAP_PX = 10;
export const BONUSTIME_CHECKLIST_BASE_WIDTH_PX =
  (BONUSTIME_CHECKLIST_GRID_COLS * BONUSTIME_CHECKLIST_BASE_BOX_SIZE_PX) +
  ((BONUSTIME_CHECKLIST_GRID_COLS - 1) * BONUSTIME_CHECKLIST_BASE_GAP_PX);
export const BONUSTIME_CHECKLIST_BASE_HEIGHT_PX =
  (BONUSTIME_CHECKLIST_GRID_ROWS * BONUSTIME_CHECKLIST_BASE_BOX_SIZE_PX) +
  ((BONUSTIME_CHECKLIST_GRID_ROWS - 1) * BONUSTIME_CHECKLIST_BASE_GAP_PX);

export function fitRectWithinBonusTimeArea(
  container: Rect,
  baseWidth: number,
  baseHeight: number,
  paddingPx: number = BONUSTIME_GAME_PADDING_PX
): FittedRect {
  const innerWidth = Math.max(1, container.width - (paddingPx * 2));
  const innerHeight = Math.max(1, container.height - (paddingPx * 2));
  const scale = Math.min(innerWidth / baseWidth, innerHeight / baseHeight);
  const width = baseWidth * scale;
  const height = baseHeight * scale;

  return {
    x: container.x + ((container.width - width) / 2),
    y: container.y + ((container.height - height) / 2),
    width,
    height,
    scale
  };
}
