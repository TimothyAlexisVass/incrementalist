import { GameChannel } from "../../../net/game-channel";
import { playBonusTime } from "../../../net/commands";
import { InteractionState } from "../../../ui/managers/interactions";
import {
  getBonusTimeWelcomeLayout,
  isPointInBonusTimeWelcomeButton,
  shouldOpenBonusTimeRewardModal,
  isPointInRect
} from "../flow";
import {
  HammerSmashData,
  POLE_RISE_MS,
  BELL_HIT_MS
} from "./view-model";

export enum HammerSmashState {
  IDLE,
  PREPARING,
  SMASH_1,
  SMASH_2,
  SMASH_3,
  POLE_RISING,
  BELL_HIT,
  REVEALED
}

let internalState = HammerSmashState.IDLE;
let waitingForResult = false;
let previousPlayedAt: string | null = null;
let resolvedPlayedAt: string | null = null;

// Per-smash animation
let currentSmashStartedAt = 0;

// Pole rise
let poleRiseStartedAt = 0;

// Bell hit
let bellHitStartedAt = 0;

// Reward modal
let rewardModalStartTime = 0;

// Manual clicks
let smashClicked = false;
let smashClickedAt = 0;
let clickPowerVal = 0;

// Piecewise timeline parameters for settle simulation
let phase0Duration = 0;
let boundary0 = 0;
let boundary1 = 0;
let boundary2 = 0;
const phase1Duration = 700;
const phase2Duration = 950;
const phase3Duration = 1100;

export function getHammerSmashState() {
  return internalState;
}

export function getRewardWaitStartedAt() {
  return rewardModalStartTime;
}

export function getSettleDuration(): number {
  return phase0Duration + phase1Duration + phase2Duration + phase3Duration;
}

export function getSmashAnimationProgress(): number {
  if (!smashClicked || smashClickedAt <= 0) return 0;
  const elapsed = performance.now() - smashClickedAt;
  const total = getSettleDuration();
  return Math.min(1, elapsed / total);
}

export function getStrikerRiseProgress(): number {
  if (!smashClicked || smashClickedAt <= 0) return 0;
  const elapsed = performance.now() - smashClickedAt;
  const startOfPhase3 = phase0Duration + phase1Duration + phase2Duration;
  if (elapsed < startOfPhase3) return 0;
  return Math.min(1, (elapsed - startOfPhase3) / phase3Duration);
}

export function getPoleRiseProgress(): number {
  if (poleRiseStartedAt <= 0) return 0;
  return Math.min(1, (performance.now() - poleRiseStartedAt) / POLE_RISE_MS);
}

export function getBellHitProgress(): number {
  if (bellHitStartedAt <= 0) return 0;
  return Math.min(1, (performance.now() - bellHitStartedAt) / BELL_HIT_MS);
}

export function isSmashClicked() {
  return smashClicked;
}

export function getSmashClickedAt() {
  return smashClickedAt;
}

export function getClickPowerVal() {
  return clickPowerVal;
}

export function getSweepValue(now: number): number {
  const period = 1200;
  const cycle = (now % period) / period;
  const val = cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2;
  return Math.max(0.01, val);
}

export function getSettleFillPercent(now: number, targetVal: number): number {
  const elapsed = now - smashClickedAt;
  
  // Phase 0: complete current sweep
  if (elapsed < phase0Duration) {
    const progress = elapsed / phase0Duration;
    return clickPowerVal + (boundary0 - clickPowerVal) * progress;
  }
  
  // Phase 1: first full sweep opposite
  let currentElapsed = elapsed - phase0Duration;
  if (currentElapsed < phase1Duration) {
    const progress = currentElapsed / phase1Duration;
    return boundary0 + (boundary1 - boundary0) * easeInOutQuad(progress);
  }
  
  // Phase 2: second full sweep back
  currentElapsed -= phase1Duration;
  if (currentElapsed < phase2Duration) {
    const progress = currentElapsed / phase2Duration;
    return boundary1 + (boundary2 - boundary1) * easeInOutQuad(progress);
  }
  
  // Phase 3: settle to target
  currentElapsed -= phase2Duration;
  const progress = Math.min(1, currentElapsed / phase3Duration);
  return boundary2 + (targetVal - boundary2) * easeOutCubic(progress);
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
}

export interface HammerSmashRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getSmashButtonRect(
  gameRect: { x: number; y: number; width: number; height: number }
): HammerSmashRect {
  const buttonWidth = 180;
  const buttonHeight = 44;
  const centerX = gameRect.x + gameRect.width / 2 - 40; // Center relative to power bar
  const buttonY = gameRect.y + gameRect.height - 85;
  return {
    x: centerX - buttonWidth / 2,
    y: buttonY,
    width: buttonWidth,
    height: buttonHeight
  };
}

export function resetHammerSmashState() {
  internalState = HammerSmashState.IDLE;
  waitingForResult = false;
  previousPlayedAt = null;
  resolvedPlayedAt = null;
  currentSmashStartedAt = 0;
  poleRiseStartedAt = 0;
  bellHitStartedAt = 0;
  rewardModalStartTime = 0;
  smashClicked = false;
  smashClickedAt = 0;
  clickPowerVal = 0;
  phase0Duration = 0;
  boundary0 = 0;
  boundary1 = 0;
  boundary2 = 0;
}

export function handleHammerSmashInteractions(
  input: InteractionState,
  data: HammerSmashData,
  rect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const now = performance.now();

  if (internalState === HammerSmashState.IDLE) {
    const welcomeLayout = getBonusTimeWelcomeLayout(rect, {
      cardWidth: 500,
      cardHeight: 330,
      buttonWidth: 240,
      buttonHeight: 50,
      cardYOffset: -20,
      buttonOffsetY: 70
    });

    const isOverBtn = isPointInBonusTimeWelcomeButton(input.pointer, welcomeLayout);

    if (isOverBtn && input.clicked && !input.consumed && data.hasToken && channel) {
      internalState = HammerSmashState.PREPARING;
      waitingForResult = true;
      previousPlayedAt = data.lastPlayedAt;
      resolvedPlayedAt = null;
      currentSmashStartedAt = 0;
      poleRiseStartedAt = 0;
      bellHitStartedAt = 0;
      rewardModalStartTime = 0;
      smashClicked = false;
      smashClickedAt = 0;
      clickPowerVal = 0;
      phase0Duration = 0;
      boundary0 = 0;
      boundary1 = 0;
      boundary2 = 0;

      if (runCommand) {
        runCommand(() => playBonusTime(channel, "hammer_smash"));
      } else {
        playBonusTime(channel, "hammer_smash");
      }

      input.consumed = true;
    }
    return null;
  }

  // Detect fresh result
  if (waitingForResult) {
    const hasFreshResult =
      !!data.lastPlayedAt &&
      data.lastPlayedAt !== previousPlayedAt &&
      data.lastPlayedAt !== resolvedPlayedAt &&
      data.smashes != null;

    if (hasFreshResult) {
      waitingForResult = false;
      resolvedPlayedAt = data.lastPlayedAt;
      internalState = HammerSmashState.SMASH_1;
      smashClicked = false;
      smashClickedAt = 0;
      clickPowerVal = 0;
      phase0Duration = 0;
      boundary0 = 0;
      boundary1 = 0;
      boundary2 = 0;
    }
    return null;
  }

  // Smash phases (1, 2, 3): wait for manual click, then settle
  if (
    internalState === HammerSmashState.SMASH_1 ||
    internalState === HammerSmashState.SMASH_2 ||
    internalState === HammerSmashState.SMASH_3
  ) {
    if (!smashClicked) {
      const btnRect = getSmashButtonRect(rect);
      const isOverBtn = isPointInRect(input.pointer, btnRect);

      if (isOverBtn && input.clicked && !input.consumed) {
        smashClicked = true;
        smashClickedAt = now;
        clickPowerVal = getSweepValue(now);

        const cycle = (now % 1200) / 1200;
        const isGoingUp = cycle < 0.5;

        boundary0 = isGoingUp ? 1 : 0;
        boundary1 = isGoingUp ? 0 : 1;
        boundary2 = isGoingUp ? 1 : 0;

        const distance = isGoingUp ? (1.0 - clickPowerVal) : clickPowerVal;
        phase0Duration = distance * 600; // 600ms for full sweep of 1.0 distance

        input.consumed = true;
      }
    } else {
      const elapsed = now - smashClickedAt;
      if (elapsed >= getSettleDuration()) {
        smashClicked = false;
        smashClickedAt = 0;
        clickPowerVal = 0;
        phase0Duration = 0;
        boundary0 = 0;
        boundary1 = 0;
        boundary2 = 0;

        // Transition to next state
        if (internalState === HammerSmashState.SMASH_1) {
          internalState = HammerSmashState.SMASH_2;
        } else if (internalState === HammerSmashState.SMASH_2) {
          internalState = HammerSmashState.SMASH_3;
        } else {
          internalState = HammerSmashState.POLE_RISING;
          poleRiseStartedAt = now;
        }
      }
    }
    return null;
  }

  // Pole rising
  if (internalState === HammerSmashState.POLE_RISING) {
    if (now - poleRiseStartedAt >= POLE_RISE_MS) {
      if (data.bellHit) {
        internalState = HammerSmashState.BELL_HIT;
        bellHitStartedAt = now;
      } else {
        internalState = HammerSmashState.REVEALED;
        rewardModalStartTime = now;
      }
    }
    return null;
  }

  // Bell hit animation
  if (internalState === HammerSmashState.BELL_HIT) {
    if (now - bellHitStartedAt >= BELL_HIT_MS) {
      internalState = HammerSmashState.REVEALED;
      rewardModalStartTime = now;
    }
    return null;
  }

  // Revealed - wait for modal delay
  if (internalState === HammerSmashState.REVEALED) {
    if (shouldOpenBonusTimeRewardModal(rewardModalStartTime, now)) {
      return { type: "open_modal" as const };
    }
  }

  return null;
}
