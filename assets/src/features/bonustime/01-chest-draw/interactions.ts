import { InteractionState } from "../../../ui/managers/interactions";
import { GameChannel } from "../../../net/game-channel";
import { playDailyBonus } from "../../../net/commands";
import { ChestDrawData } from "./view-model";

export enum ChestState {
  IDLE,
  REVEALING,
  REVEALED
}

let internalState = ChestState.IDLE;
let revealStartTime = 0;

export function getChestState() { return internalState; }
export function resetChestState() { internalState = ChestState.IDLE; }

export function getLastRewardButtonRect(centerX: number, centerY: number) {
  return {
    x: centerX - 100,
    y: centerY - 20,
    width: 200,
    height: 40
  };
}

export function handleChestDrawInteractions(
  input: InteractionState,
  data: ChestDrawData,
  chestRect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel
) {
  const isHover = input.pointer &&
                  input.pointer.x >= chestRect.x && input.pointer.x <= chestRect.x + chestRect.width &&
                  input.pointer.y >= chestRect.y && input.pointer.y <= chestRect.y + chestRect.height;

  if (isHover && input.clicked && !input.consumed) {
    if (internalState === ChestState.IDLE && data.hasToken && channel) {
      internalState = ChestState.REVEALING;
      revealStartTime = performance.now();
      playDailyBonus(channel, "chest_draw");
      input.consumed = true;
    } else if (internalState === ChestState.REVEALED) {
      input.consumed = true;
      internalState = ChestState.IDLE; // Reset for next time
      return { type: 'open_modal' as const };
    }
  }

  // Handle Last Reward button when out of tokens
  if (internalState === ChestState.IDLE && !data.hasToken && data.lastTier) {
    const centerX = chestRect.x + chestRect.width / 2;
    const centerY = chestRect.y + chestRect.height / 2;
    const btnRect = getLastRewardButtonRect(centerX, centerY + 80);
    
    const isOverBtn = input.pointer &&
                      input.pointer.x >= btnRect.x && input.pointer.x <= btnRect.x + btnRect.width &&
                      input.pointer.y >= btnRect.y && input.pointer.y <= btnRect.y + btnRect.height;
    
    if (isOverBtn && input.clicked && !input.consumed) {
      input.consumed = true;
      return { type: 'open_modal' as const };
    }
  }

  // Transition from REVEALING to REVEALED only when result is ready
  if (internalState === ChestState.REVEALING) {
    const elapsed = performance.now() - revealStartTime;
    if (elapsed > 1500 && data.lastTier !== null) {
      internalState = ChestState.REVEALED;
    }
  }

  return null;
}
