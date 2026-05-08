import { COLORS } from "../../colors";
import { DISPLAY_AREA_HEIGHT, DISPLAY_AREA_WIDTH, DISPLAY_AREA_X, DISPLAY_AREA_Y, REWARD_POPUP_FONT } from "../../config";
import { formatSignedNumber } from "../../format";
import { clampNumber, parseFontSizePx } from "../../utils";
import { getProgressBarLayout } from "./render";
import { computeLevelUps } from "../hud/progression";
import { spawnFloatingText, spawnRewardPopup } from "../../render/effects";
import { TOP_HUD_EXP_BAR_X, TOP_HUD_EXP_BAR_Y, TOP_HUD_EXP_BAR_HEIGHT } from "../../config";

let nextLevelUpNoticeGroupId = 1;

export type ResourceAmounts = {
  exp: number;
  level: number;
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
  const levelGain = Math.max(0, Math.floor(newAmounts.level) - Math.floor(currentAmounts.level));
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

  if (levelGain > 0) {
    const levelUps = computeLevelUps(currentAmounts.level, newAmounts.level);
    spawnLevelUpEffects(floatingTexts, canvas, levelUps);
  }

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

function getAvailableNoticeGroupIndexes(floatingTexts: any[], type: string, count: number) {
  const occupiedIndexes = new Set<number>();

  for (const floatingText of floatingTexts) {
    if (
      floatingText.type === type &&
      floatingText.stackGroupId !== null &&
      Number.isFinite(floatingText.stackIndex)
    ) {
      occupiedIndexes.add(floatingText.stackIndex);
    }
  }

  const indexes = [];
  let nextIndex = 0;

  while (indexes.length < count) {
    if (!occupiedIndexes.has(nextIndex)) {
      indexes.push(nextIndex);
      occupiedIndexes.add(nextIndex);
    }
    nextIndex += 1;
  }

  return indexes;
}

function spawnLevelUpEffects(floatingTexts: unknown[], canvas: HTMLCanvasElement, levelUps: ReturnType<typeof computeLevelUps>) {
  if (levelUps.length === 0) return;

  const popupLifeMs = 5000; // ACHIEVEMENT_ANNOUNCEMENT_LIFE_MS
  const popupRiseSpeed = 2; // ACHIEVEMENT_FLOAT_RISE_SPEED
  const baseX = TOP_HUD_EXP_BAR_X + 8;
  const baseY = TOP_HUD_EXP_BAR_Y + TOP_HUD_EXP_BAR_HEIGHT + 52;
  const lineStep = 30;
  const groupStep = 108;
  const groupIndexes = getAvailableNoticeGroupIndexes(floatingTexts, "level_up", levelUps.length);

  for (let i = 0; i < levelUps.length; i += 1) {
    const levelUp = levelUps[i];
    const groupId = nextLevelUpNoticeGroupId;
    const groupIndex = groupIndexes[i];
    nextLevelUpNoticeGroupId += 1;

    const popupOptions = {
      lifeMs: popupLifeMs,
      riseSpeed: popupRiseSpeed,
      font: REWARD_POPUP_FONT,
      textAlign: "left",
      type: "level_up",
      stackGroupId: groupId,
      stackIndex: groupIndex
    };

    const baseLineY = baseY + (groupIndex * groupStep);
    const levelText = `Level Up!`;
    const coinText = formatSignedNumber(levelUp.rewards.coins);
    const shardText = formatSignedNumber(levelUp.rewards.shards);
    const coreText = formatSignedNumber(levelUp.rewards.cores);

    spawnFloatingText(floatingTexts, levelText, baseX, baseLineY, COLORS.rewards.achievement, popupOptions);
    spawnFloatingText(floatingTexts, coinText, baseX, baseLineY + lineStep, COLORS.rewards.coins, popupOptions);

    if (levelUp.rewards.shards > 0) {
      spawnFloatingText(floatingTexts, shardText, baseX, baseLineY + (lineStep * 2), COLORS.rewards.shards, popupOptions);
    }

    if (levelUp.rewards.cores > 0) {
      spawnFloatingText(floatingTexts, coreText, baseX, baseLineY + (lineStep * 3), COLORS.rewards.cores, popupOptions);
    }
  }
}

