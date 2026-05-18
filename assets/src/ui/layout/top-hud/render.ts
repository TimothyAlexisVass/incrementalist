import { COLORS } from "../../../colors";
import {
  TOP_HUD_EXP_BAR_X, TOP_HUD_EXP_BAR_Y, TOP_HUD_EXP_BAR_WIDTH, TOP_HUD_EXP_BAR_HEIGHT,
  TOP_HUD_LEVEL_X, TOP_HUD_LEVEL_Y, TOP_HUD_EXP_COUNTER_X,
  TOP_HUD_CURRENCY_ICON_SIZE,
  TOP_HUD_COIN_COUNTER_Y, TOP_HUD_COINS_COUNTER_RIGHT, TOP_HUD_SHARDS_COUNTER_RIGHT, TOP_HUD_CORES_COUNTER_RIGHT,
  TOP_HUD_LEVEL_FONT, TOP_HUD_EXP_FONT, TOP_HUD_COINS_FONT
} from "../../../config";
import { formatNumber, formatNumberRatio } from "../../../utils";
import { BigNum, toNumber } from "../../../core/bignum";
import { getRequiredExp } from "./progression";
import { getHudViewModel, getAndClearQueuedLevelUps } from "./view-model";
import { drawCurrencyAmount } from "../../../render/currency-icons";
import { spawnGpuProgressCompletionBurst } from "../../../render/webgl-effects";
import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { drawHorizontalBar, getHorizontalBarCenterY } from "../../components/bar";
import { resolveUpdatingText } from "../../../utils/text";

const EXP_BAR_LEVEL_UP_PARTICLE_GRAVITY = 520;
const EXP_BAR_LEVEL_UP_PARTICLE_LIFE_MULTIPLIER = 2;
const EXP_BAR_FILL_LERP_SPEED = 12;
const EXP_BAR_LEVEL_UP_COLORS = Object.freeze([
  COLORS.bar.exp.fillStart,
  COLORS.bar.exp.fillEnd,
  '#ffffff',
  COLORS.rewards.expGain
]);
const TOP_HUD_EXP_TEXT_KEY = "top_hud.exp";
const TOP_HUD_LEVEL_TEXT_KEY = "top_hud.level";
let displayedExpFillRatio = 0;
let hasExpFillInitialized = false;

export function renderTopHUD(canvas: HTMLCanvasElement, dtMs: number) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;
  const model = getHudViewModel();

  const queued = getAndClearQueuedLevelUps();
  if (queued > 0) {
    spawnExpBarLevelUpBurst();
  }

  renderer.drawRect({
    x: 0,
    y: 0,
    width: canvas.width,
    height: TOP_HUD_EXP_BAR_Y + TOP_HUD_EXP_BAR_HEIGHT + 16,
    color: cssToRgba(COLORS.panel.bg)
  });

  const requiredExp = getRequiredExp(model.displayedLevel);
  const fillRatio = Math.min(1, Math.max(0, toNumber(model.displayedExp) / toNumber(requiredExp)));
  if (!hasExpFillInitialized) {
    displayedExpFillRatio = fillRatio;
    hasExpFillInitialized = true;
  } else {
    const lerpAmount = 1 - Math.exp(-EXP_BAR_FILL_LERP_SPEED * (Math.max(0, dtMs) / 1000));
    displayedExpFillRatio += (fillRatio - displayedExpFillRatio) * lerpAmount;
  }
  displayedExpFillRatio = Math.min(1, Math.max(0, displayedExpFillRatio));
  const expBarRect = {
    x: TOP_HUD_EXP_BAR_X,
    y: TOP_HUD_EXP_BAR_Y,
    width: TOP_HUD_EXP_BAR_WIDTH,
    height: TOP_HUD_EXP_BAR_HEIGHT
  };

  drawHorizontalBar(
    expBarRect,
    {
      fillRatio: displayedExpFillRatio,
      fillStartColor: COLORS.bar.exp.fillStart,
      fillEndColor: COLORS.bar.exp.fillEnd
    }
  );

  const expText = resolveUpdatingText(
    TOP_HUD_EXP_TEXT_KEY,
    `${formatNumberRatio(model.displayedExp, requiredExp)} EXP`,
    (candidate) => renderer.isTextReady({
      text: candidate,
      font: TOP_HUD_EXP_FONT,
      color: COLORS.panel.textPrimary,
      align: 'center',
      baseline: 'middle'
    })
  );
  renderer.drawText({
    text: expText,
    x: TOP_HUD_EXP_COUNTER_X,
    y: getHorizontalBarCenterY(expBarRect),
    font: TOP_HUD_EXP_FONT,
    color: COLORS.panel.textPrimary,
    align: 'center',
    baseline: 'middle'
  });
  const levelText = resolveUpdatingText(
    TOP_HUD_LEVEL_TEXT_KEY,
    String(model.displayedLevel),
    (candidate) => renderer.isTextReady({
      text: candidate,
      font: TOP_HUD_LEVEL_FONT,
      color: COLORS.panel.textPrimary,
      align: 'left',
      baseline: 'alphabetic'
    })
  );
  renderer.drawText({
    text: levelText,
    x: TOP_HUD_LEVEL_X,
    y: TOP_HUD_LEVEL_Y,
    font: TOP_HUD_LEVEL_FONT,
    color: COLORS.panel.textPrimary,
    align: 'left',
    baseline: 'alphabetic'
  });
  renderHudCurrencies(canvas);
}

function renderHudCurrencies(canvas: HTMLCanvasElement) {
  const model = getHudViewModel();
  drawCurrency(canvas, "Coins", model.displayedCoins, COLORS.panel.coins, TOP_HUD_COINS_COUNTER_RIGHT);
  drawCurrency(canvas, "Shards", model.displayedShards, COLORS.panel.shards, TOP_HUD_SHARDS_COUNTER_RIGHT);
  drawCurrency(canvas, "Cores", model.displayedCores, COLORS.panel.cores, TOP_HUD_CORES_COUNTER_RIGHT);
}

function cssToRgba(color: string): [number, number, number, number] {
  const hex = String(color || '').trim().replace(/^#/, '');
  const expanded = hex.length === 3 ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex;
  const parsed = Number.parseInt(expanded, 16);
  if (!Number.isFinite(parsed)) return [1, 1, 1, 1];
  return [((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255, 1];
}

function drawCurrency(canvas: HTMLCanvasElement, label: string, amount: BigNum, color: string, counterRight: number) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;
  const stableAmountText = resolveUpdatingText(
    `top_hud.currency.${label.toLowerCase()}`,
    formatNumber(amount),
    (candidate) => renderer.isTextReady({
      text: candidate,
      font: TOP_HUD_COINS_FONT,
      color,
      align: 'left',
      baseline: 'alphabetic',
      strokeColor: color,
      strokeWidth: 0.6
    })
  );
  drawCurrencyAmount(
    label.toLowerCase(),
    amount,
    canvas.width - counterRight,
    TOP_HUD_COIN_COUNTER_Y,
    TOP_HUD_CURRENCY_ICON_SIZE,
    {
      align: 'right',
      font: TOP_HUD_COINS_FONT,
      textColor: color,
      iconGap: 6,
      iconPosition: 'right',
      // Keep currency counters on a stable width so text-sync updates do not nudge the HUD.
      widthMode: 'estimated',
      formatter: () => stableAmountText
    }
  );
}

function spawnExpBarLevelUpBurst() {
  spawnGpuProgressCompletionBurst(
    TOP_HUD_EXP_BAR_X,
    TOP_HUD_EXP_BAR_Y,
    TOP_HUD_EXP_BAR_WIDTH,
    TOP_HUD_EXP_BAR_HEIGHT,
    EXP_BAR_LEVEL_UP_COLORS as any,
    {
      countMultiplier: 3,
      gravity: EXP_BAR_LEVEL_UP_PARTICLE_GRAVITY,
      lifeMultiplier: EXP_BAR_LEVEL_UP_PARTICLE_LIFE_MULTIPLIER
    }
  );
}
