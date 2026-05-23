import { DISPLAY_AREA_HEIGHT, DISPLAY_AREA_WIDTH, DISPLAY_AREA_X, DISPLAY_AREA_Y } from "../../../config";
import { searchCloverfield } from "../../../net/commands";
import type { GameChannel } from "../../../net/game-channel";
import type { ServerResult } from "../../../net/protocol";
import { pointInRect, type InteractionState } from "../../../ui/managers/interactions";
import {
  beginCloverfieldThresholdDispatch,
  finishCloverfieldThresholdDispatch,
  registerCloverfieldSearchClick
} from "./view-model";

const CLOVERFIELD_INTERACTION_RECT = {
  x: DISPLAY_AREA_X,
  y: DISPLAY_AREA_Y,
  width: DISPLAY_AREA_WIDTH,
  height: DISPLAY_AREA_HEIGHT
};

export function handleCloverfieldInteractions(
  input: InteractionState,
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<ServerResult>) => Promise<ServerResult | null> | void,
  blocked: boolean = false
) {
  if (!blocked && input.clicked && !input.consumed && input.pointer) {
    const isInsideArea = pointInRect(input.pointer, CLOVERFIELD_INTERACTION_RECT);

    if (isInsideArea) {
      registerCloverfieldSearchClick();
      input.consumed = true;
    }
  }

  if (!channel || !runCommand) return;
  if (!beginCloverfieldThresholdDispatch()) return;

  const run = runCommand(() => searchCloverfield(channel));

  if (!run || typeof (run as Promise<ServerResult | null>).then !== "function") {
    finishCloverfieldThresholdDispatch(false);
    return;
  }

  (run as Promise<ServerResult | null>)
    .then((result) => {
      finishCloverfieldThresholdDispatch(result !== null);
    })
    .catch(() => {
      finishCloverfieldThresholdDispatch(false);
    });
}
