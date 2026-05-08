import { COLORS } from "../../colors";
import { DISPLAY_AREA_HEIGHT, DISPLAY_AREA_WIDTH, DISPLAY_AREA_X, DISPLAY_AREA_Y, REWARD_POPUP_FONT } from "../../config";
import { formatSignedNumber } from "../../format";
import { spawnRewardPopup } from "../../render/effects";
import { clampNumber, parseFontSizePx } from "../../utils";
import { getProgressBarLayout } from "./render";

export type ResourceAmounts = {
  exp: number;
  coins: number;
  shards: number;
  cores: number;
};

type RewardEntry = {
  text: string;
  font: string;
  offsetX: number;
  offsetY: number;
};

const POPUP_OFFSET = Object.freeze({
  exp: { x: -55, y: -20 },
  coins: { x: 55, y: -20 },
  shards: { x: -55, y: 12 },
  cores: { x: 55, y: 12 }
});

export function spawnProgressClaimRewardEffects(
  floatingTexts: unknown[],
  canvas: HTMLCanvasElement,
  textMeasureContext: CanvasRenderingContext2D,
  currentAmounts: ResourceAmounts,
  newAmounts: ResourceAmounts,
  anchorPoint: { x: number; y: number } | null = null
) {
  const expGain = Math.max(0, Math.floor(newAmounts.exp) - Math.floor(currentAmounts.exp));
  const coinGain = Math.max(0, Math.floor(newAmounts.coins) - Math.floor(currentAmounts.coins));
  const shardGain = Math.max(0, Math.floor(newAmounts.shards) - Math.floor(currentAmounts.shards));
  const coreGain = Math.max(0, Math.floor(newAmounts.cores) - Math.floor(currentAmounts.cores));

  const expText = formatSignedNumber(expGain);
  const coinText = formatSignedNumber(coinGain);
  const shardText = formatSignedNumber(shardGain);
  const coreText = formatSignedNumber(coreGain);

  const rewardGroupEntries: RewardEntry[] = [
    { text: expText, font: REWARD_POPUP_FONT, offsetX: POPUP_OFFSET.exp.x, offsetY: POPUP_OFFSET.exp.y },
    { text: coinText, font: REWARD_POPUP_FONT, offsetX: POPUP_OFFSET.coins.x, offsetY: POPUP_OFFSET.coins.y }
  ];

  if (shardGain > 0) {
    rewardGroupEntries.push({ text: shardText, font: REWARD_POPUP_FONT, offsetX: POPUP_OFFSET.shards.x, offsetY: POPUP_OFFSET.shards.y });
  }

  if (coreGain > 0) {
    rewardGroupEntries.push({ text: coreText, font: REWARD_POPUP_FONT, offsetX: POPUP_OFFSET.cores.x, offsetY: POPUP_OFFSET.cores.y });
  }

  const barLayout = getProgressBarLayout(canvas);
  const rawAnchor = anchorPoint ?? {
    x: barLayout.x + barLayout.width / 2,
    y: barLayout.y + barLayout.height / 2
  };

  const anchor = clampRewardAnchorToCanvas(textMeasureContext, canvas, rawAnchor, rewardGroupEntries);

  spawnRewardPopup(
    floatingTexts,
    canvas,
    expText,
    anchor.x + POPUP_OFFSET.exp.x,
    anchor.y + POPUP_OFFSET.exp.y,
    COLORS.rewards.expGain,
    "exp"
  );
  spawnRewardPopup(
    floatingTexts,
    canvas,
    coinText,
    anchor.x + POPUP_OFFSET.coins.x,
    anchor.y + POPUP_OFFSET.coins.y,
    COLORS.rewards.coins,
    "coins"
  );

  if (shardGain > 0) {
    spawnRewardPopup(
      floatingTexts,
      canvas,
      shardText,
      anchor.x + POPUP_OFFSET.shards.x,
      anchor.y + POPUP_OFFSET.shards.y,
      COLORS.rewards.shards,
      "shards"
    );
  }

  if (coreGain > 0) {
    spawnRewardPopup(
      floatingTexts,
      canvas,
      coreText,
      anchor.x + POPUP_OFFSET.cores.x,
      anchor.y + POPUP_OFFSET.cores.y,
      COLORS.rewards.cores,
      "cores"
    );
  }
}

function clampRewardAnchorToCanvas(
  textMeasureContext: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  point: { x: number; y: number },
  entries: RewardEntry[]
) {
  let minX = Number.NEGATIVE_INFINITY;
  let maxX = Number.POSITIVE_INFINITY;
  let minY = Number.NEGATIVE_INFINITY;
  let maxY = Number.POSITIVE_INFINITY;

  for (const entry of entries) {
    const bounds = getCenteredPopupAnchorBounds(textMeasureContext, canvas, entry.text, entry.font, entry.offsetX, entry.offsetY);
    minX = Math.max(minX, bounds.minX);
    maxX = Math.min(maxX, bounds.maxX);
    minY = Math.max(minY, bounds.minY);
    maxY = Math.min(maxY, bounds.maxY);
  }

  if (maxX < minX) {
    minX = canvas.width / 2;
    maxX = canvas.width / 2;
  }

  if (maxY < minY) {
    minY = canvas.height / 2;
    maxY = canvas.height / 2;
  }

  return {
    x: clampNumber(point.x, minX, maxX),
    y: clampNumber(point.y, minY, maxY)
  };
}

function getCenteredPopupAnchorBounds(
  textMeasureContext: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  text: string,
  font: string,
  offsetX: number,
  offsetY: number,
  margin = 8
) {
  const fontSize = parseFontSizePx(font);
  const textWidth = measureTextWidth(textMeasureContext, text, font);
  const halfWidth = textWidth / 2;
  const bottomPadding = Math.max(6, Math.round(fontSize * 0.3));
  const displayAreaRight = DISPLAY_AREA_X + DISPLAY_AREA_WIDTH;
  const displayAreaBottom = DISPLAY_AREA_Y + DISPLAY_AREA_HEIGHT;

  return {
    minX: DISPLAY_AREA_X + margin + halfWidth - offsetX,
    maxX: displayAreaRight - margin - halfWidth - offsetX,
    minY: DISPLAY_AREA_Y + margin + fontSize - offsetY,
    maxY: displayAreaBottom - margin - bottomPadding - offsetY
  };
}

function measureTextWidth(textMeasureContext: CanvasRenderingContext2D, text: string, font: string) {
  textMeasureContext.save();
  textMeasureContext.font = font;
  const width = textMeasureContext.measureText(text).width;
  textMeasureContext.restore();
  return width;
}

