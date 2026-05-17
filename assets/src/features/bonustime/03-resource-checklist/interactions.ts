import { InteractionState } from "../../../ui/managers/interactions";
import { GameChannel } from "../../../net/game-channel";
import { playBonusTime } from "../../../net/commands";
import { ResourceChecklistData } from "./view-model";

export enum ResourceChecklistState {
  IDLE,
  REVEALING,
  REVEALED
}

let internalState = ResourceChecklistState.IDLE;
let revealStartTime = 0;

export function getResourceChecklistState() { return internalState; }
export function resetResourceChecklistState() { internalState = ResourceChecklistState.IDLE; }

export function handleResourceChecklistInteractions(
  input: InteractionState,
  data: ResourceChecklistData,
  rect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const isHover = input.pointer &&
                  input.pointer.x >= rect.x && input.pointer.x <= rect.x + rect.width &&
                  input.pointer.y >= rect.y && input.pointer.y <= rect.y + rect.height;

  if (isHover && input.clicked && !input.consumed) {
    if (internalState === ResourceChecklistState.IDLE && data.hasToken && channel) {
      internalState = ResourceChecklistState.REVEALING;
      revealStartTime = performance.now();

      if (runCommand) {
        runCommand(() => playBonusTime(channel, "resource_checklist"));
      } else {
        playBonusTime(channel, "resource_checklist");
      }

      input.consumed = true;
    } else if (internalState === ResourceChecklistState.REVEALED) {
      input.consumed = true;
      return { type: 'open_modal' as const };
    }
  }

  if (internalState === ResourceChecklistState.REVEALING) {
    const elapsed = performance.now() - revealStartTime;
    if (elapsed > 1000 && data.lastTier !== null) {
      internalState = ResourceChecklistState.REVEALED;
    }
  }

  return null;
}
