import { InteractionState } from "../../../ui/managers/interactions";
import { GameChannel } from "../../../net/game-channel";
import { playBonusTime } from "../../../net/commands";
import { PrizeWheelData } from "./view-model";
import { fitRectWithinBonusTimeArea } from "../layout";
import {
  getBonusTimeWelcomeLayout,
  isPointInBonusTimeWelcomeButton,
  shouldOpenBonusTimeRewardModal
} from "../flow";

export enum WheelState {
  IDLE,
  SPINNING,
  SPUN
}

let internalState = WheelState.IDLE;
let spinStartTime = 0;
let rewardModalStartTime = 0;

export function getWheelState() { return internalState; }
export function getRewardWaitStartedAt() { return rewardModalStartTime; }
export function resetWheelState() {
  internalState = WheelState.IDLE;
  spinStartTime = 0;
  rewardModalStartTime = 0;
}

export function handlePrizeWheelInteractions(
  input: InteractionState,
  data: PrizeWheelData,
  wheelRect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const layout = fitRectWithinBonusTimeArea(wheelRect, 300, 300);
  const welcomeLayout = getBonusTimeWelcomeLayout(wheelRect, {
    cardWidth: 440,
    cardHeight: 300,
    buttonWidth: 240,
    buttonHeight: 50,
    cardYOffset: -20,
    buttonOffsetY: 70
  });

  if (isPointInBonusTimeWelcomeButton(input.pointer, welcomeLayout) && input.clicked && !input.consumed) {
    if (internalState === WheelState.IDLE && data.hasToken && channel) {
      internalState = WheelState.SPINNING;
      spinStartTime = performance.now();

      if (runCommand) {
        runCommand(() => playBonusTime(channel, "prize_wheel"));
      } else {
        playBonusTime(channel, "prize_wheel");
      }

      input.consumed = true;
    }
  }

  // Transition from SPINNING to SPUN only when result is ready
  if (internalState === WheelState.SPINNING) {
    const elapsed = performance.now() - spinStartTime;
    if (elapsed > 1500 && data.lastTier !== null) {
      internalState = WheelState.SPUN;
      rewardModalStartTime = performance.now();
    }
  } else if (internalState === WheelState.SPUN) {
    if (shouldOpenBonusTimeRewardModal(rewardModalStartTime, performance.now())) {
      return { type: 'open_modal' as const };
    }
  }

  return null;
}
