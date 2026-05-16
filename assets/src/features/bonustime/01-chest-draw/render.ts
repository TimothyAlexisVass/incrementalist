import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { hexToRgba, cssToRgba } from "../../../utils";
import { ChestDrawData } from "./view-model";
import { ChestState, getChestState } from "./interactions";
import { MODAL_TITLE_FONT, MODAL_BODY_FONT } from "../../../config";

const RARITY_LABELS: Record<number, string> = {
  1: "Common", 2: "Rare", 3: "Elite", 4: "Excellent", 5: "Unique", 6: "Exotic", 7: "Ultimate"
};

const RARITY_COLORS: Record<number, string> = {
  1: "#9aa7b5", 2: "#56a8ff", 3: "#52df87", 4: "#ba77ff", 5: "#ffbe4d", 6: "#ff5b8f", 7: "#ffffff"
};

export function renderChestDraw(
  data: ChestDrawData,
  rect: { x: number; y: number; width: number; height: number }
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const state = getChestState();
  const now = performance.now();
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  const chestSize = 120;
  const chestX = centerX - chestSize / 2;
  const chestY = centerY - chestSize / 2;

  let color = "#4a5568";
  let label = "?";

  if (state === ChestState.REVEALING) {
    const hue = (now % 1000) / 1000 * 360;
    color = `hsl(${hue}, 70%, 50%)`;
    label = "REVEALING...";
  } else if (state === ChestState.REVEALED && data.lastTier) {
    color = RARITY_COLORS[data.lastTier] || "#fff";
    label = RARITY_LABELS[data.lastTier].toUpperCase();
  }

  renderer.drawRect({
    x: chestX, y: chestY, width: chestSize, height: chestSize,
    color: color.startsWith("#") ? hexToRgba(color) : cssToRgba(color)
  });

  renderer.drawText({
    text: label, x: centerX, y: chestY - 20, font: MODAL_TITLE_FONT,
    color: color.startsWith("#") ? color : "#fff", align: 'center', baseline: 'alphabetic'
  });

  let instruction = "";
  if (state === ChestState.IDLE) {
    instruction = data.hasToken ? "CLICK TO REVEAL" : "OUT OF TOKENS";
  } else if (state === ChestState.REVEALED) {
    instruction = "CLICK TO OPEN";
  }

  if (instruction) {
    renderer.drawText({
      text: instruction, x: centerX, y: chestY + chestSize + 40,
      font: MODAL_BODY_FONT, color: "#a0aec0", align: 'center', baseline: 'alphabetic'
    });
  }
}
