import { COLORS } from "../../colors";
import {
  SISU_MAX_FONT,
  SISU_UPGRADE_BUTTON_FONT,
  SMALL_TEXT_FONT,
  DISPLAY_AREA_X,
  DISPLAY_AREA_Y,
  DISPLAY_AREA_WIDTH,
  DISPLAY_AREA_HEIGHT
} from "../../config";
import type { BigNum } from "../../core/bignum";
import type { GameChannel } from "../../net/game-channel";
import type { ServerResult } from "../../net/protocol";
import type { ServerState } from "../../net/snapshots";
import { drawCurrencyAmount, measureCurrencyAmount } from "../../render/currency-icons";
import { getActiveWebGLRenderer, type RGBA, type WebGLRenderer } from "../../renderer/webgl";
import { drawButton } from "../../ui/components/button";
import { drawLazyLoader } from "../../ui/components/utils/lazy-loader";
import { pointInRect, type InteractionState } from "../../ui/managers/interactions";
import type { Modal } from "../../ui/managers/modals";
import { hexToRgba } from "../../utils/color";
import { formatCountRatio, formatNumber, formatSisuMultiplier } from "../../utils/format";

import { handleSisuModalInteractions, type SisuRefillHitRect } from "./interactions";
import {
  getChargeCrystalCount,
  getSisuTierTarget,
  getUpgradeButtonState,
  SISU_BASE_MAX,
  SISU_MAX_UPGRADE_LEVEL,
  SISU_MIN_MULTIPLIER,
  SISU_REFILL_TIERS,
  toFiniteBigNumNumber,
  updateSisuVisualProjection,
  type Rect,
  type TierId
} from "./view-model";

export const SISU_MODAL_SCALE = 0.57;

const SISU_HOVER_TRANSITION_MS = 200;
const SISU_CRYSTAL_BUTTON_FALLBACK_WIDTH = 120;
const SISU_CRYSTAL_BUTTON_FALLBACK_HEIGHT = 120;

// Tier button positions in source-modal coordinates before SISU_MODAL_SCALE is applied.
// Adjust these values directly to move the crystal purchase buttons.
const SISU_CRYSTAL_BUTTON_POSITIONS: Record<TierId, { x: number; y: number }> = Object.freeze({
  azure: { x: 68, y: 233 },
  aether: { x: 292, y: 233 },
  lucent: { x: 509, y: 233 },
  transcendent: { x: 734, y: 233 }
});

const SISU_TIER_IDS: readonly TierId[] = ["azure", "aether", "lucent", "transcendent"];

type CrystalButtonSpriteState = "deactivated" | "activated" | "hover";
type CrystalButtonSpriteSet = Record<CrystalButtonSpriteState, HTMLImageElement>;

const SISU_CRYSTAL_BUTTON_SOURCES: Record<TierId, Record<CrystalButtonSpriteState, string>> = Object.freeze({
  azure: {
    deactivated: "images/azure_deactivated.png",
    activated: "images/azure_activated.png",
    hover: "images/azure_hover.png"
  },
  aether: {
    deactivated: "images/aether_deactivated.png",
    activated: "images/aether_activated.png",
    hover: "images/aether_hover.png"
  },
  lucent: {
    deactivated: "images/lucent_deactivated.png",
    activated: "images/lucent_activated.png",
    hover: "images/lucent_hover.png"
  },
  transcendent: {
    deactivated: "images/transcendent_deactivated.png",
    activated: "images/transcendent_activated.png",
    hover: "images/transcendent_hover.png"
  }
});

let sisuModalBackgroundImage: HTMLImageElement | null = null;
let sisuCrystalButtonSprites: Record<TierId, CrystalButtonSpriteSet> | null = null;

function getSisuModalBackgroundImage() {
  if (!sisuModalBackgroundImage) {
    sisuModalBackgroundImage = new Image();
    sisuModalBackgroundImage.src = "images/sisu_modal.png";
  }

  return sisuModalBackgroundImage;
}

function getSisuCrystalButtonSprites() {
  if (!sisuCrystalButtonSprites) {
    sisuCrystalButtonSprites = {
      azure: createTierSpriteSet("azure"),
      aether: createTierSpriteSet("aether"),
      lucent: createTierSpriteSet("lucent"),
      transcendent: createTierSpriteSet("transcendent")
    };
  }

  return sisuCrystalButtonSprites;
}

function createTierSpriteSet(tierId: TierId): CrystalButtonSpriteSet {
  const sources = SISU_CRYSTAL_BUTTON_SOURCES[tierId];
  return {
    deactivated: createImage(sources.deactivated),
    activated: createImage(sources.activated),
    hover: createImage(sources.hover)
  };
}

function createImage(src: string) {
  const image = new Image();
  image.src = src;
  return image;
}

function isImageReady(image: HTMLImageElement) {
  return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
}

export function createSisuGeneratorModal(
  getState: () => ServerState,
  channel: GameChannel,
  runCommand: (cmd: () => Promise<ServerResult>) => Promise<ServerResult | null>,
  onClose: () => void
): Modal {
  return new SisuGeneratorModalImpl(getState, channel, runCommand, onClose);
}

class SisuGeneratorModalImpl implements Modal {
  private readonly refillRects: SisuRefillHitRect[] = [];
  private readonly hoverBlendByTier: Record<TierId, number> = {
    azure: 0,
    aether: 0,
    lucent: 0,
    transcendent: 0
  };
  private readonly hoverTargetByTier: Record<TierId, boolean> = {
    azure: false,
    aether: false,
    lucent: false,
    transcendent: false
  };
  private modalRect: Rect | null = null;
  private upgradeRect: Rect | null = null;
  public readonly backdropAlpha = 0;
  public readonly closeOnMenuButton = true;

  constructor(
    private readonly getState: () => ServerState,
    private readonly channel: GameChannel,
    private readonly runCommand: (cmd: () => Promise<ServerResult>) => Promise<ServerResult | null>,
    private readonly onClose: () => void
  ) {}

  render(canvas: HTMLCanvasElement, input: InteractionState) {
    const renderer = getActiveWebGLRenderer();
    const snapshot = this.getState().snapshot;
    if (!snapshot || !snapshot.state.features.sisu_generator_purchased) {
      this.onClose();
      return;
    }

    const bgImage = getSisuModalBackgroundImage();
    const isModalImageReady = isImageReady(bgImage);

    const modalWidth = isModalImageReady ? bgImage.naturalWidth * SISU_MODAL_SCALE : 560;
    const modalHeight = isModalImageReady ? bgImage.naturalHeight * SISU_MODAL_SCALE : 224;

    const modalX = DISPLAY_AREA_X + DISPLAY_AREA_WIDTH - modalWidth;
    const modalY = DISPLAY_AREA_Y + DISPLAY_AREA_HEIGHT - modalHeight;

    this.modalRect = { x: modalX, y: modalY, width: modalWidth, height: modalHeight };

    if (isModalImageReady) {
      renderer.drawImage({
        image: bgImage,
        x: modalX,
        y: modalY,
        width: modalWidth,
        height: modalHeight
      });
    } else {
      renderer.drawRect({ ...this.modalRect, color: hexToRgba(COLORS.panel.bg) });
      drawRectOutline(renderer, this.modalRect, 2, hexToRgba(COLORS.overlay.panelBorder));
    }

    const { displayCurrent } = updateSisuVisualProjection(snapshot);
    const currentSisu = Math.max(SISU_MIN_MULTIPLIER, displayCurrent);
    const maxBasic = Math.max(SISU_BASE_MAX, toFiniteBigNumNumber(snapshot.state.sisu.max_basic, SISU_BASE_MAX));
    const chargeCrystals = snapshot.state.charge_crystals;

    this.refillRects.length = 0;
    for (const tierId of SISU_TIER_IDS) {
      this.hoverTargetByTier[tierId] = false;
    }

    for (const tier of SISU_REFILL_TIERS) {
      const target = getSisuTierTarget(maxBasic, tier.id);
      const availableCount = getChargeCrystalCount(chargeCrystals, tier.id);
      const hasCrystals = availableCount > 0;
      const canRefill = hasCrystals && currentSisu < target;

      const rect = getTierButtonRect(modalX, modalY, tier.id);
      const isHovered = Boolean(input.pointer && pointInRect(input.pointer, rect));

      this.hoverTargetByTier[tier.id] = hasCrystals && isHovered;
      if (!hasCrystals) {
        this.hoverBlendByTier[tier.id] = 0;
      }

      this.refillRects.push({ tier: tier.id, rect, enabled: canRefill });
      drawSisuRefillControl(
        renderer,
        rect,
        tier.id,
        target,
        availableCount,
        this.hoverBlendByTier[tier.id],
        canRefill
      );
    }

    if (isModalImageReady) {
      this.upgradeRect = {
        x: modalX + 510 * SISU_MODAL_SCALE,
        y: modalY + 620 * SISU_MODAL_SCALE,
        width: 410 * SISU_MODAL_SCALE,
        height: 120 * SISU_MODAL_SCALE
      };
    } else {
      this.upgradeRect = {
        x: modalX + modalWidth - 180 - 22,
        y: modalY + 156,
        width: 180,
        height: 36
      };
    }

    const maxUpgradeLevel = snapshot.state.sisu.max_upgrade_level || 0;
    const maxSisuText = `Base ${formatSisuMultiplier(maxBasic)}(Level ${formatCountRatio(maxUpgradeLevel, SISU_MAX_UPGRADE_LEVEL)})`;

    renderer.drawText({
      text: maxSisuText,
      x: modalX + 40,
      y: modalY + 385,
      font: SISU_MAX_FONT,
      color: COLORS.hud.textPrimary,
      align: "left",
      baseline: "middle",
      strokeColor: "black",
      strokeWidth: 2
    });

    const upgradeState = getUpgradeButtonState(snapshot.state.shards, maxUpgradeLevel);
    const isUpgradeActive = !upgradeState.disabled && this.upgradeRect && pointInRect(input.pointer, this.upgradeRect);

    if (!isModalImageReady) {
      drawButton(this.upgradeRect, upgradeState.label, {
        active: isUpgradeActive,
        activeSurface: upgradeState.disabled ? COLORS.button.secondary.surface : COLORS.button.surface.active,
        inactiveSurface: upgradeState.disabled ? COLORS.button.secondary.surface : COLORS.button.surface.active,
        activeBorder: upgradeState.disabled ? COLORS.button.secondary.border : COLORS.button.border.active,
        inactiveBorder: upgradeState.disabled ? COLORS.button.secondary.border : COLORS.button.border.active,
        textColor: COLORS.button.text,
        font: SISU_UPGRADE_BUTTON_FONT,
        textY: this.upgradeRect.y + 23
      });
    }

    if (upgradeState.cost !== null) {
      if (isModalImageReady) {
        drawUpgradeCostLabel(this.upgradeRect, null, upgradeState.cost, this.upgradeRect.y + this.upgradeRect.height - 20);
      } else {
        drawUpgradeCostLabel(this.upgradeRect, upgradeState.prefix, upgradeState.cost);
      }
    }

    handleSisuModalInteractions(
      canvas,
      input,
      this.modalRect,
      this.upgradeRect,
      !upgradeState.disabled,
      this.refillRects,
      this.channel,
      this.runCommand,
      this.onClose
    );
  }

  tick(dt: number, _input: InteractionState) {
    const frameDeltaMs = Math.max(0, Number(dt) || 0);
    const transitionStep = SISU_HOVER_TRANSITION_MS > 0 ? frameDeltaMs / SISU_HOVER_TRANSITION_MS : 1;

    for (const tierId of SISU_TIER_IDS) {
      const target = this.hoverTargetByTier[tierId] ? 1 : 0;
      const current = this.hoverBlendByTier[tierId];

      if (target > current) {
        this.hoverBlendByTier[tierId] = Math.min(1, current + transitionStep);
      } else if (target < current) {
        this.hoverBlendByTier[tierId] = Math.max(0, current - transitionStep);
      }
    }
  }
}

function drawUpgradeCostLabel(rect: Rect, prefix: string | null, cost: BigNum, overrideY?: number) {
  const renderer = getActiveWebGLRenderer();
  const textY = overrideY ?? rect.y + 63;
  const iconSize = 18;
  const iconGap = 4;
  const currencyKey = "shards";
  const textColor = COLORS.button.text;
  const leftText = prefix ? `${prefix} (` : "";
  const rightText = prefix ? ")" : "";

  const leftWidth = leftText
    ? renderer.measureTextWidth({ text: leftText, font: SISU_UPGRADE_BUTTON_FONT })
    : 0;
  const amountWidth = measureCurrencyAmount(cost, iconSize, {
    font: SISU_UPGRADE_BUTTON_FONT,
    iconGap
  });
  const rightWidth = rightText
    ? renderer.measureTextWidth({ text: rightText, font: SISU_UPGRADE_BUTTON_FONT })
    : 0;
  const totalWidth = leftWidth + amountWidth + rightWidth;
  let currentX = rect.x + rect.width / 2 - totalWidth / 2;

  if (leftText) {
    renderer.drawText({
      text: leftText,
      x: currentX + 40,
      y: textY,
      font: SISU_UPGRADE_BUTTON_FONT,
      color: textColor,
      align: "left",
      baseline: "alphabetic"
    });
    currentX += leftWidth;
  }

  drawCurrencyAmount(currencyKey, cost, currentX, textY, iconSize, {
    align: "left",
    font: SISU_UPGRADE_BUTTON_FONT,
    textColor,
    iconGap,
    formatter: formatNumber
  });
  currentX += amountWidth;

  if (rightText) {
    renderer.drawText({
      text: rightText,
      x: currentX,
      y: textY,
      font: SISU_UPGRADE_BUTTON_FONT,
      color: textColor,
      align: "left",
      baseline: "alphabetic"
    });
  }
}

function drawRectOutline(renderer: WebGLRenderer, rect: Rect, width: number, color: RGBA) {
  renderer.drawRect({ x: rect.x, y: rect.y, width: rect.width, height: width, color });
  renderer.drawRect({ x: rect.x, y: rect.y + rect.height - width, width: rect.width, height: width, color });
  renderer.drawRect({ x: rect.x, y: rect.y, width: width, height: rect.height, color });
  renderer.drawRect({ x: rect.x + rect.width - width, y: rect.y, width: width, height: rect.height, color });
}

function getTierButtonRect(modalX: number, modalY: number, tierId: TierId): Rect {
  const size = getTierButtonSize(tierId);
  const position = SISU_CRYSTAL_BUTTON_POSITIONS[tierId];

  return {
    x: modalX + position.x * SISU_MODAL_SCALE,
    y: modalY + position.y * SISU_MODAL_SCALE,
    width: size.width,
    height: size.height
  };
}

function getTierButtonSize(tierId: TierId): { width: number; height: number } {
  const sprites = getSisuCrystalButtonSprites()[tierId];
  const referenceImage =
    (isImageReady(sprites.activated) && sprites.activated) ||
    (isImageReady(sprites.deactivated) && sprites.deactivated) ||
    (isImageReady(sprites.hover) && sprites.hover) ||
    null;

  const baseWidth = referenceImage ? referenceImage.naturalWidth : SISU_CRYSTAL_BUTTON_FALLBACK_WIDTH;
  const baseHeight = referenceImage ? referenceImage.naturalHeight : SISU_CRYSTAL_BUTTON_FALLBACK_HEIGHT;

  return {
    width: baseWidth * SISU_MODAL_SCALE,
    height: baseHeight * SISU_MODAL_SCALE
  };
}

function drawSisuRefillControl(
  renderer: WebGLRenderer,
  rect: Rect,
  tierId: TierId,
  target: number,
  availableCount: number,
  hoverBlend: number,
  canRefill: boolean
) {
  drawSisuRefillSprite(renderer, rect, tierId, availableCount, hoverBlend);

  if(availableCount > 0) {
    renderer.drawText({
      text: `${formatNumber(availableCount)}`,
      x: rect.x + rect.width / 2,
      y: rect.y + 46,
      font: SMALL_TEXT_FONT,
      color: COLORS.button.text,
      align: "center",
      baseline: "middle",
      strokeColor: "black",
      strokeWidth: 2
    });
  }

  renderer.drawText({
    text: formatSisuMultiplier(target),
    x: rect.x + rect.width / 2 - 2,
    y: rect.y + rect.height - 25,
    font: SISU_UPGRADE_BUTTON_FONT,
    color: COLORS.button.text,
    align: "center",
    baseline: "middle",
    strokeColor: COLORS.sisu[tierId],
    strokeWidth: 1
  });
}

function drawSisuRefillSprite(
  renderer: WebGLRenderer,
  rect: Rect,
  tierId: TierId,
  availableCount: number,
  hoverBlend: number
) {
  const sprites = getSisuCrystalButtonSprites()[tierId];
  const hasCrystals = availableCount > 0;

  if (hasCrystals) {
    if (isImageReady(sprites.activated)) {
      const canMixHover = isImageReady(sprites.hover) && hoverBlend > 0;
      renderer.drawImage({
        image: sprites.activated,
        mixImage: canMixHover ? sprites.hover : undefined,
        mixAmount: canMixHover ? Math.max(0, Math.min(1, hoverBlend)) : 0,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        alpha: 1
      });
    } else {
      drawLazyLoader(rect, "Loading...");
      return;
    }
  } else {
    if (isImageReady(sprites.deactivated)) {
      renderer.drawImage({
        image: sprites.deactivated,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        alpha: 1
      });
      return;
    }

    drawLazyLoader(rect, "Loading...");
    return;
  }

}
