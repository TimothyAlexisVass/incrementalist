import { InteractionState } from "../../../ui/managers/interactions";
import { GameChannel } from "../../../net/game-channel";
import { playBonusTime } from "../../../net/commands";
import { ItemChecklistData } from "./view-model";

export enum ItemChecklistState {
  IDLE,
  REVEALING,
  REVEALED
}

let internalState = ItemChecklistState.IDLE;
let revealStartTime = 0;

export function getItemChecklistState() { return internalState; }
export function resetItemChecklistState() { internalState = ItemChecklistState.IDLE; }

export function handleItemChecklistInteractions(
  input: InteractionState,
  data: ItemChecklistData,
  rect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const isHover = input.pointer &&
                  input.pointer.x >= rect.x && input.pointer.x <= rect.x + rect.width &&
                  input.pointer.y >= rect.y && input.pointer.y <= rect.y + rect.height;

  if (isHover && input.clicked && !input.consumed) {
    if (internalState === ItemChecklistState.IDLE && data.hasToken && channel) {
      internalState = ItemChecklistState.REVEALING;
      revealStartTime = performance.now();

      if (runCommand) {
        runCommand(() => playBonusTime(channel, "item_checklist"));
      } else {
        playBonusTime(channel, "item_checklist");
      }

      input.consumed = true;
    } else if (internalState === ItemChecklistState.REVEALED) {
      input.consumed = true;
      return { type: 'open_modal' as const };
    }
  }

  if (internalState === ItemChecklistState.REVEALING) {
    const elapsed = performance.now() - revealStartTime;
    if (elapsed > 1000 && data.lastTier !== null) {
      internalState = ItemChecklistState.REVEALED;
    }
  }

  return null;
}
