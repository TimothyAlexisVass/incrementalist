import { InteractionState } from "../../../ui/managers/interactions";
import { GameChannel } from "../../../net/game-channel";
import { playBonusTime } from "../../../net/commands";
import { ChestDrawData } from "./view-model";
import { fitRectWithinBonusTimeArea } from "../layout";

export enum ChestState {
  IDLE,
  REVEALING,
  REVEALED
}

let internalState = ChestState.IDLE;
let revealStartTime = 0;

export function getChestState() { return internalState; }
export function resetChestState() { internalState = ChestState.IDLE; }

export function handleChestDrawInteractions(
  input: InteractionState,
  data: ChestDrawData,
  chestRect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const layout = fitRectWithinBonusTimeArea(chestRect, 300, 300);
  const isHover = input.pointer &&
                  input.pointer.x >= layout.x && input.pointer.x <= layout.x + layout.width &&
                  input.pointer.y >= layout.y && input.pointer.y <= layout.y + layout.height;

  if (isHover && input.clicked && !input.consumed) {
    if (internalState === ChestState.IDLE && data.hasToken && channel) {
      internalState = ChestState.REVEALING;
      revealStartTime = performance.now();
      
      if (runCommand) {
        runCommand(() => playBonusTime(channel, "chest_draw"));
      } else {
        playBonusTime(channel, "chest_draw");
      }
      
      input.consumed = true;
    } else if (internalState === ChestState.REVEALED) {
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
