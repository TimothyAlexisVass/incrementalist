import { COLORS } from "../../colors";
import { BOTTOM_HUD_HEIGHT, SEASON_HUD_FONT } from "../../config";
import type { ClimateState } from "../../net/protocol";
import { getActiveWebGLRenderer } from "../../renderer/webgl";
import { resolveUpdatingText } from "../../utils/text";
import { buildSeasonHudModel } from "./view-model";

const SEASON_HUD_LEFT_TEXT_KEY = "bottom_hud.season.left";
const SEASON_HUD_RIGHT_TEXT_KEY = "bottom_hud.season.right";
const CLIMATE_ICON_HEIGHT = 30;
const CLIMATE_ICON_Y_OFFSET = 10;
const CLIMATE_ICON_GAP = 8;
const climateIconImages = new Map<string, HTMLImageElement>();

export function renderSeasonHud(
  canvas: HTMLCanvasElement,
  rect: { x: number; y: number; width: number; height: number },
  climate: ClimateState | null | undefined
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer || rect.width <= 0 || rect.height <= 0) return;

  const model = buildSeasonHudModel(climate);
  if (!model) return;

  const stableLeftText = resolveUpdatingText(SEASON_HUD_LEFT_TEXT_KEY, model.leftText, (candidate) =>
    renderer.isTextReady({
      text: candidate,
      font: SEASON_HUD_FONT,
      color: COLORS.panel.textPrimary,
      align: "left",
      baseline: "middle"
    })
  );

  const stableRightText = resolveUpdatingText(SEASON_HUD_RIGHT_TEXT_KEY, model.rightText, (candidate) =>
    renderer.isTextReady({
      text: candidate,
      font: SEASON_HUD_FONT,
      color: COLORS.panel.textPrimary,
      align: "left",
      baseline: "middle"
    })
  );

  const hudTopY = canvas.height - BOTTOM_HUD_HEIGHT;
  const textY = hudTopY + 23;
  const leftTextWidth = renderer.measureTextWidth({ text: stableLeftText, font: SEASON_HUD_FONT });
  const iconX = rect.x + leftTextWidth + CLIMATE_ICON_GAP;
  const iconY = hudTopY + CLIMATE_ICON_Y_OFFSET;
  const iconWidth = drawClimateIcon(model.iconPath, iconX, iconY);

  renderer.drawText({
    text: stableLeftText,
    x: rect.x,
    y: textY,
    font: SEASON_HUD_FONT,
    color: COLORS.panel.textPrimary,
    align: "left",
    baseline: "middle"
  });

  renderer.drawText({
    text: stableRightText,
    x: iconX + iconWidth + CLIMATE_ICON_GAP,
    y: textY,
    font: SEASON_HUD_FONT,
    color: COLORS.panel.textPrimary,
    align: "left",
    baseline: "middle"
  });
}

function drawClimateIcon(iconPath: string, x: number, y: number): number {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return CLIMATE_ICON_HEIGHT;

  const image = getClimateIconImage(iconPath);
  if (!image || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    return CLIMATE_ICON_HEIGHT;
  }

  const width = Math.max(1, Math.round((image.naturalWidth / image.naturalHeight) * CLIMATE_ICON_HEIGHT));

  renderer.drawImage({
    image,
    x,
    y,
    width,
    height: CLIMATE_ICON_HEIGHT,
    alpha: 1
  });

  return width;
}

function getClimateIconImage(iconPath: string): HTMLImageElement | null {
  if (!iconPath || typeof Image === "undefined") return null;

  if (!climateIconImages.has(iconPath)) {
    const image = new Image();
    image.src = iconPath;
    climateIconImages.set(iconPath, image);
  }

  return climateIconImages.get(iconPath) || null;
}
