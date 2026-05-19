import { InteractionState } from "../../../ui/managers/interactions";
import { GameChannel } from "../../../net/game-channel";
import { playBonusTime } from "../../../net/commands";
import { JackpotMeterData } from "./view-model";
import { fitRectWithinBonusTimeArea } from "../layout";

export enum JackpotState {
  IDLE,
  ROLLING,
  REVEALED
}

let internalState = JackpotState.IDLE;
let rollStartTime = 0;

export function getJackpotState() { return internalState; }
export function resetJackpotState() { internalState = JackpotState.IDLE; }

export function handleJackpotMeterInteractions(
  input: InteractionState,
  data: JackpotMeterData,
  gameRect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const layout = fitRectWithinBonusTimeArea(gameRect, 300, 300);

  // Play Button at the bottom of the fitted area
  const btnWidth = 180 * layout.scale;
  const btnHeight = 40 * layout.scale;
  const btnX = layout.x + (layout.width - btnWidth) / 2;
  const btnY = layout.y + layout.height - btnHeight - 20 * layout.scale;

  const isHoverBtn = input.pointer &&
                     input.pointer.x >= btnX && input.pointer.x <= btnX + btnWidth &&
                     input.pointer.y >= btnY && input.pointer.y <= btnY + btnHeight;

  if (isHoverBtn && input.clicked && !input.consumed) {
    if (internalState === JackpotState.IDLE && data.hasToken && channel) {
      internalState = JackpotState.ROLLING;
      rollStartTime = performance.now();

      if (runCommand) {
        runCommand(() => playBonusTime(channel, "jackpot_meter"));
      } else {
        playBonusTime(channel, "jackpot_meter");
      }

      input.consumed = true;
    } else if (internalState === JackpotState.REVEALED) {
      input.consumed = true;
      return { type: 'open_modal' as const };
    }
  }

  // Also support clicking anywhere on the screen if REVEALED to open modal
  const isHoverAll = input.pointer &&
                     input.pointer.x >= layout.x && input.pointer.x <= layout.x + layout.width &&
                     input.pointer.y >= layout.y && input.pointer.y <= layout.y + layout.height;

  if (isHoverAll && input.clicked && !input.consumed && internalState === JackpotState.REVEALED) {
    input.consumed = true;
    return { type: 'open_modal' as const };
  }

  // Transition from ROLLING to REVEALED only when result is ready and 1.5s has elapsed
  if (internalState === JackpotState.ROLLING) {
    const elapsed = performance.now() - rollStartTime;
    if (elapsed > 1500 && data.lastTier !== null) {
      internalState = JackpotState.REVEALED;
    }
  }

  return null;
}
