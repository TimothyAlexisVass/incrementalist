import { InteractionState } from "../../../ui/managers/interactions";
import { GameChannel } from "../../../net/game-channel";
import { playBonusTime, claimCoinRain } from "../../../net/commands";
import { CoinRainData } from "./view-model";
import {
  getBonusTimeWelcomeLayout,
  isPointInBonusTimeWelcomeButton,
  shouldOpenBonusTimeRewardModal
} from "../flow";

export enum CoinRainState {
  IDLE,
  COUNTDOWN,
  PLAYING,
  FINISHED,
  REVEALED
}

let internalState = CoinRainState.IDLE;
let stateStartTime = 0;
let bucketX = 0;

export interface FallingItem {
  id: number;
  x: number;
  y: number;
  speed: number;
  tier: number; // 0 = coin, 1-7 = reward tier
}

class LCGRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

interface SimulatedItem {
  id: number;
  spawnTime: number; // ms
  x: number;
  speed: number;
  tier: number;
}

let fallingItems: FallingItem[] = [];
let simulatedSpawns: SimulatedItem[] = [];
let nextSpawnIndex = 0;
let caughtCount = 0;
let caughtIds: number[] = [];
let lastTime = 0;
let claimSent = false;
let bucketPath: [number, number][] = [];
let rewardModalStartTime = 0;

export function getCoinRainState() { return internalState; }
export function resetCoinRainState() {
  internalState = CoinRainState.IDLE;
  fallingItems = [];
  simulatedSpawns = [];
  nextSpawnIndex = 0;
  caughtCount = 0;
  caughtIds = [];
  lastTime = 0;
  claimSent = false;
  bucketPath = [];
  rewardModalStartTime = 0;
}

export function getCoinRainBucketX() { return bucketX; }
export function getCoinRainItems(): readonly FallingItem[] { return fallingItems; }
export function getCoinRainCaughtCount() { return caughtCount; }

const COUNTDOWN_DURATION_MS = 3000;
const PLAY_DURATION_MS = 7000;
const FINISHED_HOLD_MS = 1500;
const BASE_FALL_SPEED = 120;
const BUCKET_WIDTH_PX = 60;

export function handleCoinRainInteractions(
  input: InteractionState,
  data: CoinRainData,
  gameRect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const now = performance.now();
  const dt = lastTime === 0 ? 0.016 : Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  const activeSession = data.activeSession;
  const bucketWidth = activeSession ? activeSession.data.bucket_width : BUCKET_WIDTH_PX;
  const bucketSpeed = activeSession ? activeSession.data.bucket_speed : (200 + Math.min(data.streak, 200));
  const welcomeLayout = getBonusTimeWelcomeLayout(gameRect, {
    cardWidth: 440,
    cardHeight: 300,
    buttonWidth: 240,
    buttonHeight: 50,
    cardYOffset: -20,
    buttonOffsetY: 70
  });

  // Pointer tracking for bucket: moves towards the pointer based on bucketSpeed
  if (input.pointer && input.pointer.x >= gameRect.x && input.pointer.x <= gameRect.x + gameRect.width) {
    const targetX = input.pointer.x;
    const diffX = targetX - bucketX;
    const step = bucketSpeed * dt;

    if (Math.abs(diffX) <= step) {
      bucketX = targetX;
    } else {
      bucketX += Math.sign(diffX) * step;
    }
  }

  if (internalState === CoinRainState.IDLE) {
    if (isPointInBonusTimeWelcomeButton(input.pointer, welcomeLayout) && input.clicked && !input.consumed && data.hasToken && channel) {
      internalState = CoinRainState.COUNTDOWN;
      stateStartTime = now;
      fallingItems = [];
      simulatedSpawns = [];
      nextSpawnIndex = 0;
      caughtCount = 0;
      caughtIds = [];
      claimSent = false;
      bucketPath = [];
      bucketX = gameRect.x + gameRect.width / 2;

      // Fire Step 1: Start game on the server
      if (runCommand) {
        runCommand(() => playBonusTime(channel, "coin_rain"));
      } else {
        playBonusTime(channel, "coin_rain");
      }

      input.consumed = true;
    }
  } else if (internalState === CoinRainState.COUNTDOWN) {
    // We only countdown if the server has sent us the active session (with the seed!)
    if (activeSession && activeSession.type === "coin_rain") {
      // Build spawns on first frame we receive the activeSession
      if (simulatedSpawns.length === 0) {
        const { seed, timer } = activeSession.data;
        const lcg = new LCGRandom(seed);
        const totalSpawns = Math.floor(timer / 0.05);

        for (let i = 0; i < totalSpawns; i++) {
          const rType = lcg.next();
          const rX = lcg.next();

          // Streak scaling matches Elixir backend exactly
          const bonusRolls = Math.min(3, Math.floor(data.streak / 45));
          const rewardChance = 0.035 + bonusRolls * 0.005;

          let tier = 0;
          if (rType < rewardChance) {
            const rTier = lcg.next();
            const chances = [0.55, 0.25, 0.12, 0.05, 0.02, 0.009, 0.001];
            let cumulative = 0;
            for (let t = 0; t < chances.length; t++) {
              cumulative += chances[t];
              if (rTier <= cumulative) {
                tier = t + 1;
                break;
              }
            }
            if (tier === 0) tier = 1;
          }

          const speedMult = tier === 0 ? 1 : (tier + 1);
          simulatedSpawns.push({
            id: i,
            spawnTime: i * 0.05 * 1000,
            x: gameRect.x + rX * gameRect.width,
            speed: BASE_FALL_SPEED * speedMult,
            tier
          });
        }
        // Start counting down from now
        stateStartTime = now;
      }

      const elapsed = now - stateStartTime;
      if (elapsed >= COUNTDOWN_DURATION_MS) {
        internalState = CoinRainState.PLAYING;
        stateStartTime = now;
      }
    } else {
      // Keep resetting startTime until seed is loaded
      stateStartTime = now;
    }
  } else if (internalState === CoinRainState.PLAYING) {
    const elapsed = now - stateStartTime;
    const playDuration = activeSession ? activeSession.data.timer * 1000 : PLAY_DURATION_MS;

    // Record bucket path
    const relativeX = Math.max(0, Math.min(gameRect.width, bucketX - gameRect.x));
    bucketPath.push([elapsed, relativeX]);

    // Spawn items based on exact timeline
    while (nextSpawnIndex < simulatedSpawns.length && simulatedSpawns[nextSpawnIndex].spawnTime <= elapsed) {
      const spawn = simulatedSpawns[nextSpawnIndex];
      fallingItems.push({
        id: spawn.id,
        x: spawn.x,
        y: gameRect.y,
        speed: spawn.speed,
        tier: spawn.tier
      });
      nextSpawnIndex++;
    }

    // Update items
    const bucketY = gameRect.y + gameRect.height - 40;
    const halfBucket = bucketWidth / 2;

    for (let i = fallingItems.length - 1; i >= 0; i--) {
      const item = fallingItems[i];
      item.y += item.speed * dt;

      // Collision with bucket
      if (item.y >= bucketY && item.y <= bucketY + 25 &&
          item.x >= bucketX - halfBucket && item.x <= bucketX + halfBucket) {
        caughtCount++;
        caughtIds.push(item.id);
        fallingItems.splice(i, 1);
      } else if (item.y > gameRect.y + gameRect.height) {
        fallingItems.splice(i, 1);
      }
    }

    if (elapsed >= playDuration && fallingItems.length === 0) {
      internalState = CoinRainState.FINISHED;
      stateStartTime = now;
    }
  } else if (internalState === CoinRainState.FINISHED) {
    const elapsed = now - stateStartTime;
    if (elapsed >= FINISHED_HOLD_MS) {
      // Step 2: Send recorded bucket path to server!
      if (channel && !claimSent) {
        claimSent = true;
        if (runCommand) {
          runCommand(() => claimCoinRain(channel, bucketPath));
        } else {
          claimCoinRain(channel, bucketPath);
        }
      }
      internalState = CoinRainState.REVEALED;
      rewardModalStartTime = data.lastTier !== null ? now : 0;
    }
  } else if (internalState === CoinRainState.REVEALED) {
    if (rewardModalStartTime === 0 && data.lastTier !== null) {
      rewardModalStartTime = now;
    }

    if (shouldOpenBonusTimeRewardModal(rewardModalStartTime, now)) {
      return { type: 'open_modal' as const };
    }
  }

  return null;
}
