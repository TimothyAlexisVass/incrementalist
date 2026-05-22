import { InteractionState } from "../../../ui/managers/interactions";
import { GameChannel } from "../../../net/game-channel";
import { playBonusTime } from "../../../net/commands";
import { ItemChecklistData } from "./view-model";
import {
  BONUSTIME_CHECKLIST_BASE_HEIGHT_PX,
  BONUSTIME_CHECKLIST_BASE_WIDTH_PX,
  fitRectWithinBonusTimeArea
} from "../layout";
import { isPointInRect } from "../flow";

export enum ItemChecklistState {
  IDLE,
  REVEALED
}

let internalState = ItemChecklistState.IDLE;
let rewardModalStartTime = 0;

export function getItemChecklistState() { return internalState; }
export function getRewardWaitStartedAt() { return rewardModalStartTime; }
export function resetItemChecklistState() {
  internalState = ItemChecklistState.IDLE;
  rewardModalStartTime = 0;
}

export function handleItemChecklistInteractions(
  input: InteractionState,
  data: ItemChecklistData,
  rect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const boardRect = fitRectWithinBonusTimeArea(
    rect,
    BONUSTIME_CHECKLIST_BASE_WIDTH_PX,
    BONUSTIME_CHECKLIST_BASE_HEIGHT_PX
  );

  if (
    internalState === ItemChecklistState.IDLE &&
    data.hasToken &&
    channel &&
    input.clicked &&
    !input.consumed &&
    isPointInRect(input.pointer, boardRect)
  ) {
    internalState = ItemChecklistState.REVEALED;
    rewardModalStartTime = 0;

    if (runCommand) {
      runCommand(() => playBonusTime(channel, "item_checklist"));
    } else {
      playBonusTime(channel, "item_checklist");
    }

    input.consumed = true;
    return { type: "open_modal" as const };
  }

  if (internalState === ItemChecklistState.REVEALED) {
    return null;
  }

  return null;
}
