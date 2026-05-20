import { InteractionState } from "../../../ui/managers/interactions";
import { GameChannel } from "../../../net/game-channel";
import { playBonusTime } from "../../../net/commands";
import { ChestDrawData } from "./view-model";
import { fitRectWithinBonusTimeArea } from "../layout";
import {
  getBonusTimeWelcomeLayout,
  isPointInBonusTimeWelcomeButton,
  shouldOpenBonusTimeRewardModal
} from "../flow";

export enum ChestState {
  IDLE,
  REVEALING,
  REVEALED
}

let internalState = ChestState.IDLE;
let revealStartTime = 0;
let rewardModalStartTime = 0;

export function getChestState() { return internalState; }
export function resetChestState() {
  internalState = ChestState.IDLE;
  revealStartTime = 0;
  rewardModalStartTime = 0;
}

export function handleChestDrawInteractions(
  input: InteractionState,
  data: ChestDrawData,
  chestRect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const layout = fitRectWithinBonusTimeArea(chestRect, 300, 300);
  const welcomeLayout = getBonusTimeWelcomeLayout(chestRect, {
    cardWidth: 420,
    cardHeight: 300,
    buttonWidth: 240,
    buttonHeight: 50,
    cardYOffset: -20,
    buttonOffsetY: 70
  });

  if (isPointInBonusTimeWelcomeButton(input.pointer, welcomeLayout) && input.clicked && !input.consumed) {
    if (internalState === ChestState.IDLE && data.hasToken && channel) {
      internalState = ChestState.REVEALING;
      revealStartTime = performance.now();
      
      if (runCommand) {
        runCommand(() => playBonusTime(channel, "chest_draw"));
      } else {
        playBonusTime(channel, "chest_draw");
      }
      
      input.consumed = true;
    }
  }

  // Transition from REVEALING to REVEALED only when result is ready
  if (internalState === ChestState.REVEALING) {
    const elapsed = performance.now() - revealStartTime;
    if (elapsed > 1500 && data.lastTier !== null) {
      internalState = ChestState.REVEALED;
      rewardModalStartTime = performance.now();
    }
  } else if (internalState === ChestState.REVEALED) {
    if (shouldOpenBonusTimeRewardModal(rewardModalStartTime, performance.now())) {
      return { type: 'open_modal' as const };
    }
  }

  return null;
}
