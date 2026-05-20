import { InteractionState } from "../../../ui/managers/interactions";
import { GameChannel } from "../../../net/game-channel";
import { playBonusTime } from "../../../net/commands";
import { ItemChecklistData } from "./view-model";
import {
  BONUSTIME_CHECKLIST_BASE_HEIGHT_PX,
  BONUSTIME_CHECKLIST_BASE_WIDTH_PX,
  fitRectWithinBonusTimeArea
} from "../layout";

export enum ItemChecklistState {
  IDLE,
  REVEALING,
  REVEALED
}

let internalState = ItemChecklistState.IDLE;
let pendingEntryIndex = -1;

export function getItemChecklistState() { return internalState; }
export function resetItemChecklistState() {
  internalState = ItemChecklistState.IDLE;
  pendingEntryIndex = -1;
}

export function handleItemChecklistInteractions(
  input: InteractionState,
  data: ItemChecklistData,
  rect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const layout = fitRectWithinBonusTimeArea(
    rect,
    BONUSTIME_CHECKLIST_BASE_WIDTH_PX,
    BONUSTIME_CHECKLIST_BASE_HEIGHT_PX
  );
  const isHover = input.pointer &&
                  input.pointer.x >= layout.x && input.pointer.x <= layout.x + layout.width &&
                  input.pointer.y >= layout.y && input.pointer.y <= layout.y + layout.height;

  if (isHover && input.clicked && !input.consumed) {
    if (internalState === ItemChecklistState.IDLE && data.hasToken && channel) {
      internalState = ItemChecklistState.REVEALING;
      pendingEntryIndex = data.nextEntryIndex;

      if (runCommand) {
        runCommand(() => playBonusTime(channel, "item_checklist"));
      } else {
        playBonusTime(channel, "item_checklist");
      }

      input.consumed = true;
      return { type: 'open_modal' as const };
    } else if (internalState === ItemChecklistState.REVEALED) {
      input.consumed = true;
      return { type: 'open_modal' as const };
    }
  }

  if (internalState === ItemChecklistState.REVEALING) {
    if (data.nextEntryIndex !== pendingEntryIndex) {
      internalState = ItemChecklistState.REVEALED;
      pendingEntryIndex = -1;
    }
  }

  return null;
}
