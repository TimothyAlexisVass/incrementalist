import { sisuRefill, sisuUpgradeMax } from "../../net/commands";
import type { GameChannel } from "../../net/game-channel";
import type { ServerResult } from "../../net/protocol";
import { pointInRect, type InteractionState } from "../../ui/managers/interactions";

import type { Rect, TierId } from "./view-model";

export type SisuRefillHitRect = {
  tier: TierId;
  rect: Rect;
  enabled: boolean;
};

export function handleSisuModalInteractions(
  input: InteractionState,
  modalRect: Rect | null,
  upgradeRect: Rect | null,
  upgradeEnabled: boolean,
  refillRects: readonly SisuRefillHitRect[],
  channel: GameChannel,
  runCommand: (cmd: () => Promise<ServerResult>) => Promise<ServerResult | null>,
  onClose: () => void
) {
  if (modalRect && input.clicked && !input.consumed && input.pointer && !pointInRect(input.pointer, modalRect)) {
    input.consumed = true;
    onClose();
    return;
  }

  if (upgradeRect && upgradeEnabled && consumeClick(input, upgradeRect)) {
    void runCommand(() => sisuUpgradeMax(channel));
    return;
  }

  for (const refillRect of refillRects) {
    if (refillRect.enabled && consumeClick(input, refillRect.rect)) {
      void runCommand(() => sisuRefill(channel, refillRect.tier));
      return;
    }
  }
}

function consumeClick(input: InteractionState, rect: Rect | null): boolean {
  if (!rect || !input.clicked || input.consumed || !input.pointer) {
    return false;
  }

  if (!pointInRect(input.pointer, rect)) {
    return false;
  }

  input.consumed = true;
  return true;
}
