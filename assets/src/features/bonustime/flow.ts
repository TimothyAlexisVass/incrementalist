import bonustimeConfig from "../../../../shared/requirements/bonustime.json";
import { getActiveWebGLRenderer } from "../../renderer/webgl";
import { drawButton } from "../../ui/components/button";
import { hexToRgba, to255 } from "../../utils";
import { resolveUpdatingText } from "../../utils/text";
import {
  BONUSTIME_BODY_FONT,
  BONUSTIME_BUTTON_FONT,
  BONUSTIME_TITLE_FONT,
  BONUSTIME_TIMER_FONT
} from "../../config";

type BonusTimeRenderer = NonNullable<ReturnType<typeof getActiveWebGLRenderer>>;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface BonusTimeWelcomeLayout {
  centerX: number;
  centerY: number;
  cardRect: Rect;
  buttonRect: Rect;
}

export interface BonusTimeWelcomeCardOptions {
  cardWidth?: number;
  cardHeight?: number;
  buttonWidth?: number;
  buttonHeight?: number;
  cardYOffset?: number;
  buttonOffsetY?: number;
  title: string;
  bodyLines?: string[];
  streakText?: string;
  buttonText: string;
  titleFont?: string;
  bodyFont?: string;
  streakFont?: string;
  buttonFont?: string;
  titleColor?: string;
  bodyColor?: string;
  streakColor?: string;
  accentColor?: string;
  glowColor?: [number, number, number, number];
  backgroundColor?: string;
  buttonActive?: boolean;
}

export interface BonusTimeRewardCountdownBannerOptions {
  key: string;
  startedAt: number;
  headline: string;
  bodyPrefix: string;
  rect?: Rect;
  accentColor?: string;
  backgroundColor?: string;
  headlineColor?: string;
  bodyColor?: string;
  headlineFont?: string;
  bodyFont?: string;
}

const BONUS_TIME_CONFIG = bonustimeConfig as {
  reward_modal_delay_ms: number;
  game_rules: {
    card_pick?: {
      board_size?: number;
      initial_picks?: {
        base?: number;
        streak_divisor?: number;
        streak_cap?: number;
      };
    };
  };
};

export const BONUSTIME_REWARD_MODAL_DELAY_MS = BONUS_TIME_CONFIG.reward_modal_delay_ms;
export const BONUSTIME_CARD_PICK_BOARD_SIZE = BONUS_TIME_CONFIG.game_rules.card_pick?.board_size ?? 36;

export function getCardPickInitialPicks(streak: number): number {
  const rules = BONUS_TIME_CONFIG.game_rules.card_pick?.initial_picks ?? {};
  const base = rules.base ?? 2;
  const streakDivisor = rules.streak_divisor ?? 7;
  const streakCap = rules.streak_cap ?? 7;
  return base + Math.min(streakCap, Math.floor(Math.max(0, streak) / streakDivisor));
}

export function getBonusTimeWelcomeLayout(
  container: Rect,
  options: Pick<BonusTimeWelcomeCardOptions, "cardWidth" | "cardHeight" | "buttonWidth" | "buttonHeight" | "cardYOffset" | "buttonOffsetY"> = {}
): BonusTimeWelcomeLayout {
  const centerX = container.x + container.width / 2;
  const centerY = container.y + container.height / 2;
  const cardWidth = options.cardWidth ?? 560;
  const cardHeight = options.cardHeight ?? 360;
  const cardYOffset = options.cardYOffset ?? -20;
  const buttonWidth = options.buttonWidth ?? 240;
  const buttonHeight = options.buttonHeight ?? 50;
  const buttonOffsetY = options.buttonOffsetY ?? 70;

  return {
    centerX,
    centerY,
    cardRect: {
      x: centerX - cardWidth / 2,
      y: centerY - cardHeight / 2 + cardYOffset,
      width: cardWidth,
      height: cardHeight
    },
    buttonRect: {
      x: centerX - buttonWidth / 2,
      y: centerY + buttonOffsetY,
      width: buttonWidth,
      height: buttonHeight
    }
  };
}

export function isPointInRect(point: Point | null | undefined, rect: Rect): boolean {
  return !!(point &&
    point.x >= rect.x && point.x <= rect.x + rect.width &&
    point.y >= rect.y && point.y <= rect.y + rect.height);
}

export function isPointInBonusTimeWelcomeButton(point: Point | null | undefined, layout: BonusTimeWelcomeLayout): boolean {
  return isPointInRect(point, layout.buttonRect);
}

export function renderBonusTimeWelcomeCard(
  renderer: BonusTimeRenderer,
  container: Rect,
  options: BonusTimeWelcomeCardOptions
): BonusTimeWelcomeLayout {
  const layout = getBonusTimeWelcomeLayout(container, options);
  const {
    cardRect,
    buttonRect,
    centerX
  } = layout;

  const titleColor = options.titleColor ?? "#ffbe4d";
  const bodyColor = options.bodyColor ?? "#edf2f7";
  const streakColor = options.streakColor ?? "#52df87";
  const accentColor = options.accentColor ?? "#ffbe4d";
  const backgroundColor = options.backgroundColor ?? "#120d24";
  const glowColor = options.glowColor ?? [255, 190, 77, 255];

  renderer.drawGlowRect({
    x: cardRect.x,
    y: cardRect.y,
    width: cardRect.width,
    height: cardRect.height,
    color: glowColor,
    radius: 16,
    intensity: 0.3,
    outerAlpha: 0.15
  });
  renderer.drawRect({
    x: cardRect.x,
    y: cardRect.y,
    width: cardRect.width,
    height: cardRect.height,
    color: hexToRgba(backgroundColor, 0.98)
  });

  renderer.drawRect({ x: cardRect.x, y: cardRect.y, width: cardRect.width, height: 3, color: hexToRgba(accentColor, 0.8) });
  renderer.drawRect({ x: cardRect.x, y: cardRect.y + cardRect.height - 3, width: cardRect.width, height: 3, color: hexToRgba(accentColor, 0.8) });

  renderer.drawText({
    text: options.title,
    x: centerX,
    y: cardRect.y + 60,
    font: options.titleFont ?? BONUSTIME_TITLE_FONT,
    color: titleColor,
    align: "center",
    baseline: "middle"
  });

  const bodyLines = options.bodyLines ?? [];
  const bodyStartY = cardRect.y + 130;
  for (let i = 0; i < bodyLines.length; i += 1) {
    renderer.drawText({
      text: bodyLines[i],
      x: centerX,
      y: bodyStartY + (i * 28),
      font: options.bodyFont ?? BONUSTIME_BODY_FONT,
      color: bodyColor,
      align: "center",
      baseline: "middle"
    });
  }

  if (options.streakText) {
    renderer.drawText({
      text: options.streakText,
      x: centerX,
      y: cardRect.y + 337,
      font: options.streakFont ?? BONUSTIME_BODY_FONT,
      color: streakColor,
      align: "center",
      baseline: "middle"
    });
  }

  drawButton(buttonRect, options.buttonText, {
    font: options.buttonFont ?? BONUSTIME_BUTTON_FONT,
    active: !!options.buttonActive
  });

  return layout;
}

export function getBonusTimeRewardCountdownRemainingMs(startedAt: number, now = performance.now()): number {
  if (startedAt <= 0) return 0;
  return Math.max(0, BONUSTIME_REWARD_MODAL_DELAY_MS - (now - startedAt));
}

export function shouldOpenBonusTimeRewardModal(startedAt: number, now = performance.now()): boolean {
  return startedAt > 0 && (now - startedAt) >= BONUSTIME_REWARD_MODAL_DELAY_MS;
}

export function renderBonusTimeRewardCountdownBanner(
  renderer: BonusTimeRenderer,
  options: BonusTimeRewardCountdownBannerOptions
): void {
  const rect = options.rect ?? {
    x: 0,
    y: 0,
    width: 460,
    height: 80
  };

  const remainingMs = getBonusTimeRewardCountdownRemainingMs(options.startedAt);
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const bodyText = `${options.bodyPrefix}${remainingSeconds}s...`;
  const stableBodyText = resolveUpdatingText(
    options.key,
    bodyText,
    (text) => renderer.isTextReady({
      text,
      font: options.bodyFont ?? BONUSTIME_TIMER_FONT,
      color: options.bodyColor ?? "#a0aec0",
      align: "center",
      baseline: "middle"
    })
  );

  const accentColor = options.accentColor ?? "#52df87";
  const backgroundColor = options.backgroundColor ?? "#0b1a13";
  const headlineColor = options.headlineColor ?? accentColor;
  const bodyColor = options.bodyColor ?? "#a0aec0";

  renderer.drawGlowRect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: to255(hexToRgba(accentColor)),
    radius: 12,
    intensity: 0.45,
    outerAlpha: 0.25
  });
  renderer.drawRect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: hexToRgba(backgroundColor, 0.95)
  });
  renderer.drawRect({ x: rect.x, y: rect.y, width: rect.width, height: 2, color: hexToRgba(accentColor, 0.8) });
  renderer.drawRect({ x: rect.x, y: rect.y + rect.height - 2, width: rect.width, height: 2, color: hexToRgba(accentColor, 0.8) });

  renderer.drawText({
    text: options.headline,
    x: rect.x + rect.width / 2,
    y: rect.y + 28,
    font: options.headlineFont ?? BONUSTIME_BODY_FONT,
    color: headlineColor,
    align: "center",
    baseline: "middle"
  });

  renderer.drawText({
    text: stableBodyText,
    x: rect.x + rect.width / 2,
    y: rect.y + 54,
    font: options.bodyFont ?? BONUSTIME_TIMER_FONT,
    color: bodyColor,
    align: "center",
    baseline: "middle"
  });
}

export interface BonusTimeRewardCountdownRingOptions {
  centerX: number;
  centerY: number;
  remainingMs: number;
  totalMs: number;
  radius?: number;
  thickness?: number;
  backgroundColor?: string;
  trackColor?: string;
  fillColor?: string;
}

export function renderBonusTimeRewardCountdownRing(
  renderer: BonusTimeRenderer,
  options: BonusTimeRewardCountdownRingOptions
): void {
  const totalMs = Math.max(1, options.totalMs);
  const remainingMs = Math.max(0, Math.min(options.remainingMs, totalMs));
  const progress = remainingMs / totalMs;
  const radius = options.radius ?? 18;
  const thickness = options.thickness ?? 4;
  const backgroundColor = options.backgroundColor ?? "#0b1220";
  const trackColor = options.trackColor ?? "#2d3748";
  const fillColor = options.fillColor ?? "#52df87";
  const outerRadius = radius + thickness + 4;

  renderer.drawCircle(
    options.centerX,
    options.centerY,
    outerRadius,
    hexToRgba(backgroundColor, 0.9),
    0.16
  );
  renderer.drawRing(
    options.centerX,
    options.centerY,
    radius,
    thickness,
    hexToRgba(trackColor, 0.55),
    0.12
  );

  if (progress > 0.001) {
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (Math.PI * 2 * progress);
    renderer.drawArc(
      options.centerX,
      options.centerY,
      radius,
      thickness,
      startAngle,
      endAngle,
      hexToRgba(fillColor, 0.98),
      0.12
    );
  }
}
