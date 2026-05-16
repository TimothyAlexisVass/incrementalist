import { getActiveWebGLRenderer } from "../../renderer/webgl";
import { hexToRgba } from "../../utils";
import { ServerState } from "../../net/snapshots";
import { COLORS } from "../../colors";
import { 
  DISPLAY_AREA_X, DISPLAY_AREA_Y, DISPLAY_AREA_WIDTH, DISPLAY_AREA_HEIGHT,
  DAILY_BONUS_TITLE_FONT, MODAL_BODY_FONT
} from "../../config";
import { renderRewardModal, RewardModalState } from "../../ui/components/modals/reward-modal";
import { getActiveGameId, getActiveGameName } from "./view-model";
import { renderChestDraw } from "./01-chest-draw/render";
import { getChestDrawData } from "./01-chest-draw/view-model";

export function renderBonusTimeOverview(
  canvas: HTMLCanvasElement,
  state: ServerState,
  activeRewardModal: RewardModalState | null
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const snapshot = state.snapshot;
  if (!snapshot || !snapshot.state.daily_bonus) return;

  const db = snapshot.state.daily_bonus;

  // Background
  renderer.drawRect({
    x: DISPLAY_AREA_X, y: DISPLAY_AREA_Y, width: DISPLAY_AREA_WIDTH, height: DISPLAY_AREA_HEIGHT,
    color: hexToRgba(COLORS.panel.bg)
  });

  const activeGameId = getActiveGameId(state);
  const rect = { x: DISPLAY_AREA_X, y: DISPLAY_AREA_Y, width: DISPLAY_AREA_WIDTH, height: DISPLAY_AREA_HEIGHT };

  if (activeGameId === "chest_draw") {
    const data = getChestDrawData(state);
    if (data) {
      renderChestDraw(data, rect);
    }
  } else {
    renderer.drawText({
      text: `[ ${getActiveGameName(state).toUpperCase()} COMING SOON ]`,
      x: DISPLAY_AREA_X + DISPLAY_AREA_WIDTH / 2,
      y: DISPLAY_AREA_Y + DISPLAY_AREA_HEIGHT / 2,
      font: DAILY_BONUS_TITLE_FONT,
      color: "rgba(255, 255, 255, 0.4)",
      align: 'center', baseline: 'middle'
    });
  }

  // Reward Modal
  if (activeRewardModal && activeRewardModal.open) {
    renderRewardModal(canvas, activeRewardModal);
  }
}
