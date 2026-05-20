import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { hexToRgba } from "../../../utils";
import { CoinRainData } from "./view-model";
import {
  CoinRainState, getCoinRainState, getCoinRainBucketX,
  getCoinRainItems, getCoinRainCaughtCount
} from "./interactions";
import bonusTimeConfig from "../../../../../shared/requirements/bonustime.json";
import { COIN_RAIN_TIMER_FONT, COIN_RAIN_COUNTDOWN_FONT, BONUSTIME_RESULT_FONT } from "../../../config";
import { renderBonusTimeWelcomeCard } from "../flow";

const COUNTDOWN_DURATION_MS = 3000;
const PLAY_DURATION_MS = 7000;
const BUCKET_WIDTH_PX = 60;
const BUCKET_HEIGHT_PX = 16;

function getTierColor(tier: number): string {
  const tierConfig = (bonusTimeConfig.reward_tiers as any)[`tier_${tier}`];
  return tierConfig?.color || "#ffffff";
}

const COIN_COLOR = "#ffd700";
const BUCKET_COLOR = "#56a8ff";
const BG_COLOR = "#0d1117";
const CAUGHT_LABEL_COLOR = "#a0aec0";

export function renderCoinRain(
  data: CoinRainData,
  rect: { x: number; y: number; width: number; height: number }
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const state = getCoinRainState();
  const now = performance.now();
  const activeSession = data.activeSession;

  // Dark background
  renderer.drawRect({
    x: rect.x, y: rect.y, width: rect.width, height: rect.height,
    color: hexToRgba(BG_COLOR)
  });

  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  if (state === CoinRainState.IDLE) {
    renderBonusTimeWelcomeCard(renderer, rect, {
      cardWidth: 460,
      cardHeight: 300,
      title: "COIN RAIN",
      bodyLines: ["Catch falling rewards before the timer runs out."],
      streakText: `Current Streak: ${data.streak} day${data.streak === 1 ? "" : "s"}`,
      buttonText: "START RAIN",
      titleColor: COIN_COLOR,
      bodyColor: "#edf2f7",
      streakColor: "#52df87",
      accentColor: COIN_COLOR,
      glowColor: [255, 215, 0, 255],
      backgroundColor: "#0d1117",
      buttonActive: false
    });
  } else if (state === CoinRainState.COUNTDOWN) {
    const elapsed = now - getCountdownStart();
    const remaining = Math.ceil((COUNTDOWN_DURATION_MS - elapsed) / 1000);

    const label = remaining > 0 ? remaining.toString() : "GO!";
    renderer.drawText({
      text: label,
      x: centerX, y: centerY,
      font: COIN_RAIN_COUNTDOWN_FONT,
      color: "#edf2f7",
      align: 'center', baseline: 'middle'
    });
  } else if (state === CoinRainState.PLAYING) {
    // Timer
    const elapsed = now - getPlayStart();
    const playDuration = activeSession ? activeSession.data.timer * 1000 : PLAY_DURATION_MS;
    const remaining = Math.max(0, (playDuration - elapsed) / 1000);
    renderer.drawText({
      text: `${remaining.toFixed(1)}s`,
      x: rect.x + rect.width - 12, y: rect.y + 24,
      font: COIN_RAIN_TIMER_FONT,
      color: "#edf2f7",
      align: 'right', baseline: 'middle'
    });

    // Caught count
    renderer.drawText({
      text: `Caught: ${getCoinRainCaughtCount()}`,
      x: rect.x + 12, y: rect.y + 24,
      font: COIN_RAIN_TIMER_FONT,
      color: CAUGHT_LABEL_COLOR,
      align: 'left', baseline: 'middle'
    });

    // Falling items
    const items = getCoinRainItems();
    for (const item of items) {
      if (item.tier === 0) {
        // Coin: small gold circle (rendered as small rect for WebGL)
        renderer.drawRect({
          x: item.x - 4, y: item.y - 4, width: 8, height: 8,
          color: hexToRgba(COIN_COLOR)
        });
      } else {
        // Reward tier: colored square
        const color = getTierColor(item.tier);
        renderer.drawRect({
          x: item.x - 6, y: item.y - 6, width: 12, height: 12,
          color: hexToRgba(color)
        });
      }
    }

    // Bucket
    const bx = getCoinRainBucketX();
    const bucketWidth = activeSession ? activeSession.data.bucket_width : BUCKET_WIDTH_PX;
    renderer.drawRect({
      x: bx - bucketWidth / 2,
      y: rect.y + rect.height - 40,
      width: bucketWidth,
      height: BUCKET_HEIGHT_PX,
      color: hexToRgba(BUCKET_COLOR)
    });
  } else if (state === CoinRainState.FINISHED) {
    renderer.drawText({
      text: `Caught ${getCoinRainCaughtCount()} items!`,
      x: centerX, y: centerY - 10,
      font: BONUSTIME_RESULT_FONT,
      color: "#edf2f7",
      align: 'center', baseline: 'middle'
    });
  } else if (state === CoinRainState.REVEALED && data.lastTier) {
    const tierColor = getTierColor(data.lastTier);
    const tierName = (bonusTimeConfig.reward_tiers as any)[`tier_${data.lastTier}`]?.rarity || "Unknown";

    // Big tier result box
    renderer.drawRect({
      x: centerX - 80, y: centerY - 50, width: 160, height: 100,
      color: hexToRgba(tierColor)
    });
    renderer.drawText({
      text: tierName,
      x: centerX, y: centerY,
      font: BONUSTIME_RESULT_FONT,
      color: "#0d1117",
      align: 'center', baseline: 'middle'
    });
  }
}

// Timing helpers — read stateStartTime indirectly via performance snapshots.
// These approximate from the current time, matching the interaction module's state transitions.
let countdownStartCache = 0;
let playStartCache = 0;
let lastObservedState = CoinRainState.IDLE;

function getCountdownStart(): number {
  const current = getCoinRainState();
  if (current !== lastObservedState) {
    if (current === CoinRainState.COUNTDOWN) countdownStartCache = performance.now();
    if (current === CoinRainState.PLAYING) playStartCache = performance.now();
    lastObservedState = current;
  }
  return countdownStartCache;
}

function getPlayStart(): number {
  const current = getCoinRainState();
  if (current !== lastObservedState) {
    if (current === CoinRainState.PLAYING) playStartCache = performance.now();
    lastObservedState = current;
  }
  return playStartCache;
}
