import { InteractionState } from "../../../ui/managers/interactions";
import { GameChannel } from "../../../net/game-channel";
import { playBonusTime } from "../../../net/commands";
import { ResourceChecklistData } from "./view-model";
import {
  BONUSTIME_CHECKLIST_BASE_HEIGHT_PX,
  BONUSTIME_CHECKLIST_BASE_WIDTH_PX,
  fitRectWithinBonusTimeArea
} from "../layout";
import {
  getBonusTimeWelcomeLayout,
  isPointInBonusTimeWelcomeButton,
  shouldOpenBonusTimeRewardModal
} from "../flow";

export enum ResourceChecklistState {
  IDLE,
  REVEALING,
  REVEALED
}

let internalState = ResourceChecklistState.IDLE;
let pendingEntryIndex = -1;
let rewardModalStartTime = 0;

export function getResourceChecklistState() { return internalState; }
export function getRewardWaitStartedAt() { return rewardModalStartTime; }
export function resetResourceChecklistState() {
  internalState = ResourceChecklistState.IDLE;
  pendingEntryIndex = -1;
  rewardModalStartTime = 0;
}

export function handleResourceChecklistInteractions(
  input: InteractionState,
  data: ResourceChecklistData,
  rect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const layout = fitRectWithinBonusTimeArea(
    rect,
    BONUSTIME_CHECKLIST_BASE_WIDTH_PX,
    BONUSTIME_CHECKLIST_BASE_HEIGHT_PX
  );
  const welcomeLayout = getBonusTimeWelcomeLayout(rect, {
    cardWidth: 520,
    cardHeight: 320,
    buttonWidth: 240,
    buttonHeight: 50,
    cardYOffset: -20,
    buttonOffsetY: 70
  });

  if (isPointInBonusTimeWelcomeButton(input.pointer, welcomeLayout) && input.clicked && !input.consumed) {
    if (internalState === ResourceChecklistState.IDLE && data.hasToken && channel) {
      internalState = ResourceChecklistState.REVEALING;
      pendingEntryIndex = data.nextEntryIndex;

      if (runCommand) {
        runCommand(() => playBonusTime(channel, "resource_checklist"));
      } else {
        playBonusTime(channel, "resource_checklist");
      }

      input.consumed = true;
    }
  }

  if (internalState === ResourceChecklistState.REVEALING) {
    if (data.nextEntryIndex !== pendingEntryIndex) {
      internalState = ResourceChecklistState.REVEALED;
      pendingEntryIndex = -1;
      rewardModalStartTime = performance.now();
    }
  } else if (internalState === ResourceChecklistState.REVEALED) {
    if (shouldOpenBonusTimeRewardModal(rewardModalStartTime, performance.now())) {
      return { type: 'open_modal' as const };
    }
  }

  return null;
}
