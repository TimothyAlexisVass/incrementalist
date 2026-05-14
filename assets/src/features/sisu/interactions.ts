import { sisuRefill, sisuUpgradeMax } from "../../net/commands";
import type { GameChannel } from "../../net/game-channel";
import type { ServerResult } from "../../net/protocol";
import { pointInRect, type InteractionState } from "../../ui/managers/interactions";
import { COLORS } from "../../colors";
import { getProgressBarLayout } from "../progress-bar/render";
import { spawnGpuSisuParticleBurst } from "../../render/webgl-effects";

import type { Rect, TierId } from "./view-model";

export type SisuRefillHitRect = {
  tier: TierId;
  rect: Rect;
  enabled: boolean;
};

export function handleSisuModalInteractions(
  canvas: HTMLCanvasElement,
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
      const progressBar = getProgressBarLayout(canvas);
      const targetX = progressBar.x + progressBar.width / 2;
      const targetY = progressBar.y + progressBar.height + 120;
      
      spawnGpuSisuParticleBurst(
        refillRect.rect.x + refillRect.rect.width / 2,
        refillRect.rect.y + refillRect.rect.height / 2,
        targetX,
        targetY,
        COLORS.sisu[refillRect.tier]
      );

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
