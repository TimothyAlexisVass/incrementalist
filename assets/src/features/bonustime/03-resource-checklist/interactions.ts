import { InteractionState } from "../../../ui/managers/interactions";
import { GameChannel } from "../../../net/game-channel";
import { playBonusTime } from "../../../net/commands";
import { ResourceChecklistData } from "./view-model";
import {
  BONUSTIME_CHECKLIST_BASE_HEIGHT_PX,
  BONUSTIME_CHECKLIST_BASE_WIDTH_PX,
  fitRectWithinBonusTimeArea
} from "../layout";
import { isPointInRect } from "../flow";

export enum ResourceChecklistState {
  IDLE,
  REVEALED
}

let internalState = ResourceChecklistState.IDLE;
let rewardModalStartTime = 0;

export function getResourceChecklistState() { return internalState; }
export function getRewardWaitStartedAt() { return rewardModalStartTime; }
export function resetResourceChecklistState() {
  internalState = ResourceChecklistState.IDLE;
  rewardModalStartTime = 0;
}

export function handleResourceChecklistInteractions(
  input: InteractionState,
  data: ResourceChecklistData,
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
    internalState === ResourceChecklistState.IDLE &&
    data.hasToken &&
    channel &&
    input.clicked &&
    !input.consumed &&
    isPointInRect(input.pointer, boardRect)
  ) {
    internalState = ResourceChecklistState.REVEALED;
    rewardModalStartTime = 0;

    if (runCommand) {
      runCommand(() => playBonusTime(channel, "resource_checklist"));
    } else {
      playBonusTime(channel, "resource_checklist");
    }

    input.consumed = true;
    return { type: "open_modal" as const };
  }

  if (internalState === ResourceChecklistState.REVEALED) {
    return null;
  }

  return null;
}
