import {
  GENERIC_FLOAT_LIFE_MS,
  GENERIC_FLOAT_RISE_SPEED,
  REWARD_POPUP_FLY_MS,
  REWARD_POPUP_HOLD_MS,
  REWARD_POPUP_HOLD_RISE_SPEED,
  TOP_HUD_CORES_COUNTER_RIGHT,
  TOP_HUD_COIN_COUNTER_Y,
  TOP_HUD_EXP_COUNTER_X,
  TOP_HUD_EXP_COUNTER_Y,
  TOP_HUD_SHARDS_COUNTER_RIGHT,
  TOP_HUD_COINS_COUNTER_RIGHT,
  CANVAS_WIDTH,
  REWARD_POPUP_FONT,
} from '../config';
import { COLORS } from '../colors';
import { parseFontSizePx } from '../utils';
import { getActiveWebGLRenderer } from '../renderer/webgl';

const TWO_PI = Math.PI * 2;
const CLICK_BURST_COLORS = Object.freeze([
  COLORS.rewards.coins,
  COLORS.rewards.shards,
  COLORS.rewards.cores,
  COLORS.rewards.achievement,
  COLORS.rewards.questSummary
]);
const MAX_CLICK_PARTICLES = 120;
const MAX_FLOATING_TEXTS = 72;
const REWARD_POPUP_MIN_RENDER_SIZE_PX = 1;

export interface FloatingText {
  text: string;
  x: number;
  y: number;
  startX: number;
  startY: number;
  color: string;
  alpha: number;
  elapsedMs: number;
  type: string;
  targetX: number;
  targetY: number;
  holdMs: number;
  flyMs: number;
  riseSpeed: number;
  holdRiseSpeed: number;
  lifeMs: number;
  font: string;
  textAlign: CanvasTextAlign;
  scale: number;
  minRenderSizePx: number;
  stackGroupId: number | null;
  stackIndex: number | null;
}



export function createFloatingTextState(): FloatingText[] {
  return [];
}



export interface FloatingTextOptions {
  type?: string;
  targetX?: number;
  targetY?: number;
  holdMs?: number;
  flyMs?: number;
  riseSpeed?: number;
  holdRiseSpeed?: number;
  lifeMs?: number;
  font?: string;
  textAlign?: CanvasTextAlign;
  scale?: number;
  minRenderSizePx?: number;
  stackGroupId?: number | null;
  stackIndex?: number | null;
}

export function spawnFloatingText(
  floatingTexts: FloatingText[],
  text: string | number,
  x: number,
  y: number,
  color: string,
  options: FloatingTextOptions = {}
) {
  if (!Array.isArray(floatingTexts)) return;

  floatingTexts.push({
    text: String(text ?? ''),
    x,
    y,
    startX: x,
    startY: y,
    color,
    alpha: 1.0,
    elapsedMs: 0,
    type: options.type || 'generic',
    targetX: options.targetX ?? x,
    targetY: options.targetY ?? y,
    holdMs: options.holdMs ?? 0,
    flyMs: options.flyMs ?? 0,
    riseSpeed: options.riseSpeed ?? GENERIC_FLOAT_RISE_SPEED,
    holdRiseSpeed: options.holdRiseSpeed ?? REWARD_POPUP_HOLD_RISE_SPEED,
    lifeMs: options.lifeMs ?? GENERIC_FLOAT_LIFE_MS,
    font: options.font || REWARD_POPUP_FONT,
    textAlign: options.textAlign || 'center',
    scale: options.scale ?? 1,
    minRenderSizePx: options.minRenderSizePx ?? 0,
    stackGroupId: options.stackGroupId ?? null,
    stackIndex: options.stackIndex ?? null
  });

  if (floatingTexts.length > MAX_FLOATING_TEXTS) {
    floatingTexts.splice(0, floatingTexts.length - MAX_FLOATING_TEXTS);
  }
}



export function getHudRewardTargets(canvas: HTMLCanvasElement | null) {
  const canvasWidth = canvas?.width ?? CANVAS_WIDTH;

  return {
    exp: {
      x: TOP_HUD_EXP_COUNTER_X,
      y: TOP_HUD_EXP_COUNTER_Y
    },
    coins: { x: canvasWidth - TOP_HUD_COINS_COUNTER_RIGHT, y: TOP_HUD_COIN_COUNTER_Y },
    shards: { x: canvasWidth - TOP_HUD_SHARDS_COUNTER_RIGHT, y: TOP_HUD_COIN_COUNTER_Y },
    cores: { x: canvasWidth - TOP_HUD_CORES_COUNTER_RIGHT, y: TOP_HUD_COIN_COUNTER_Y }
  };
}

export function spawnRewardPopup(
  floatingTexts: FloatingText[],
  canvas: HTMLCanvasElement | null,
  text: string | number,
  x: number,
  y: number,
  color: string,
  targetKey: 'exp' | 'coins' | 'shards' | 'cores'
) {
  const targets = getHudRewardTargets(canvas);
  const target = targets[targetKey] || targets.coins;

  spawnFloatingText(floatingTexts, text, x, y, color, {
    type: 'reward',
    targetX: target.x,
    targetY: target.y,
    holdMs: REWARD_POPUP_HOLD_MS,
    flyMs: REWARD_POPUP_FLY_MS,
    holdRiseSpeed: REWARD_POPUP_HOLD_RISE_SPEED,
    font: REWARD_POPUP_FONT,
    textAlign: 'center',
    minRenderSizePx: REWARD_POPUP_MIN_RENDER_SIZE_PX
  });
}

export function updateFloatingTexts(floatingTexts: FloatingText[], deltaTime: number) {
  if (!Array.isArray(floatingTexts) || floatingTexts.length === 0) return;

  const deltaSeconds = deltaTime / 1000;
  let writeIndex = 0;

  for (let i = 0; i < floatingTexts.length; i += 1) {
    const ft = floatingTexts[i];
    ft.elapsedMs += deltaTime;

    if (ft.type === 'reward') {
      updateRewardPopup(ft);
    } else {
      ft.y -= ft.riseSpeed * deltaSeconds;
      ft.alpha = Math.max(0, 1 - (ft.elapsedMs / ft.lifeMs));
    }

    if (!shouldRemoveFloatingText(ft)) {
      floatingTexts[writeIndex] = ft;
      writeIndex += 1;
    }
  }

  floatingTexts.length = writeIndex;
}





export function renderFloatingTexts(floatingTexts: FloatingText[]) {
  if (!Array.isArray(floatingTexts) || floatingTexts.length === 0) return;
  const renderer = getActiveWebGLRenderer();

  for (let i = 0; i < floatingTexts.length; i += 1) {
    const ft = floatingTexts[i];
    if (ft.alpha <= 0) continue;
    const scale = getFloatingTextRenderScale(ft);
    if (scale <= 0) continue;
    const drawX = Math.round(ft.x);
    const drawY = Math.round(ft.y);

    // Layer order (outer -> inner) is built back-to-front:
    // 1) white outer outline + shadow
    // 2) black inner outline
    // 3) colored fill text
    renderer.drawText({
      text: ft.text,
      x: drawX,
      y: drawY,
      font: ft.font,
      color: 'rgba(0, 0, 0, 0)',
      align: ft.textAlign,
      baseline: 'alphabetic',
      alpha: ft.alpha,
      scale: scale,
      strokeColor: '#ffffff',
      strokeWidth: 8,
      shadowColor: 'rgba(0, 0, 0, 0.6)',
      shadowBlur: 4,
      shadowOffsetX: 2,
      shadowOffsetY: 2
    });

    renderer.drawText({
      text: ft.text,
      x: drawX,
      y: drawY,
      font: ft.font,
      color: 'rgba(0, 0, 0, 0)',
      align: ft.textAlign,
      baseline: 'alphabetic',
      alpha: ft.alpha,
      scale: scale,
      strokeColor: 'rgba(0, 0, 0, 0.8)',
      strokeWidth: 3,
      shadowColor: 'transparent',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0
    });

    renderer.drawText({
      text: ft.text,
      x: drawX,
      y: drawY,
      font: ft.font,
      color: ft.color,
      align: ft.textAlign,
      baseline: 'alphabetic',
      alpha: ft.alpha,
      scale: scale,
      strokeColor: 'transparent',
      strokeWidth: 0,
      shadowColor: 'transparent',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0
    });
  }
}

function getFloatingTextRenderScale(ft: FloatingText): number {
  const requestedScale = Number.isFinite(ft.scale) ? Math.max(0, ft.scale) : 1;
  const minRenderSizePx = Number.isFinite(ft.minRenderSizePx)
    ? Math.max(0, ft.minRenderSizePx)
    : 0;

  if (minRenderSizePx <= 0) {
    return requestedScale;
  }
  const fontSize = parseFontSizePx(ft.font, 16);
  return Math.max(requestedScale, minRenderSizePx / Math.max(1, fontSize));
}



function updateRewardPopup(ft: FloatingText) {
  const holdElapsed = Math.min(ft.elapsedMs, ft.holdMs);
  const holdDistance = ft.holdRiseSpeed * (holdElapsed / 1000);
  const holdY = ft.startY - holdDistance;

  if (ft.elapsedMs <= ft.holdMs) {
    ft.x = ft.startX;
    ft.y = holdY;
    ft.alpha = 1;
    ft.scale = 1;
    return;
  }

  const flyElapsed = ft.elapsedMs - ft.holdMs;
  const flyProgress = ft.flyMs > 0 ? Math.min(flyElapsed / ft.flyMs, 1) : 1;
  const eased = 1 - Math.pow(1 - flyProgress, 3);

  ft.x = ft.startX + (ft.targetX - ft.startX) * eased;
  ft.y = holdY + (ft.targetY - holdY) * eased;
  ft.alpha = Math.max(0, 1 - flyProgress);
  ft.scale = 1 - (flyProgress * 0.9);
}

function shouldRemoveFloatingText(ft: FloatingText) {
  if (ft.type === 'reward') {
    return ft.elapsedMs >= ft.holdMs + ft.flyMs;
  }

  return ft.elapsedMs >= ft.lifeMs;
}
