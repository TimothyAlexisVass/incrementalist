import { COLORS } from '../../../colors';
import { 
  DISPLAY_AREA_X, DISPLAY_AREA_Y, DISPLAY_AREA_WIDTH, DISPLAY_AREA_HEIGHT,
  MODAL_TITLE_FONT, MODAL_BODY_FONT 
} from '../../../config';
import { getActiveWebGLRenderer } from '../../../renderer/webgl';
import { hexToRgba } from '../../../utils/color';
import { drawButton } from '../button';
import { BigNum } from '../../../core/bignum';
import { formatBigNum } from '../../../utils/format';
import bonustimeConfig from '../../../../../shared/requirements/bonustime.json';

function getTierColor(tier: number): string {
  const tierConfig = (bonustimeConfig.reward_tiers as any)[`tier_${tier}`];
  return tierConfig?.color || "#ffffff";
}

export interface RewardModalState {
  open: boolean;
  tier: number;
  rarity: string;
  rewardAmount: BigNum;
}

export interface ModalRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RewardModalLayout {
  modalRect: ModalRect;
  okRect: ModalRect;
}


export function getRewardModalLayout(_canvas: { width: number, height: number }): RewardModalLayout {
  const modalWidth = 360;
  const modalHeight = 240;
  
  const modalX = DISPLAY_AREA_X + Math.floor((DISPLAY_AREA_WIDTH - modalWidth) / 2);
  const modalY = DISPLAY_AREA_Y + Math.floor((DISPLAY_AREA_HEIGHT - modalHeight) / 2);

  const buttonWidth = 120;
  const buttonHeight = 40;
  const okRect = {
    x: modalX + Math.floor((modalWidth - buttonWidth) / 2),
    y: modalY + modalHeight - 60,
    width: buttonWidth,
    height: buttonHeight
  };

  return {
    modalRect: { x: modalX, y: modalY, width: modalWidth, height: modalHeight },
    okRect
  };
}

export function renderRewardModal(
  canvas: HTMLCanvasElement,
  state: RewardModalState
): RewardModalLayout | null {
  const renderer = getActiveWebGLRenderer();
  if (!renderer || !canvas || !state?.open) {
    return null;
  }

  const layout = getRewardModalLayout(canvas);
  const { modalRect, okRect } = layout;

  const rarityColor = getTierColor(state.tier);

  // Backdrop
  renderer.drawRect({
    x: DISPLAY_AREA_X,
    y: DISPLAY_AREA_Y,
    width: DISPLAY_AREA_WIDTH,
    height: DISPLAY_AREA_HEIGHT,
    color: [0, 0, 0, 0.6]
  });

  // Modal Panel
  renderer.drawRect({
    x: modalRect.x,
    y: modalRect.y,
    width: modalRect.width,
    height: modalRect.height,
    color: hexToRgba(COLORS.panel.bg)
  });

  // Color-coded Border
  drawRectOutline(renderer, modalRect.x, modalRect.y, modalRect.width, modalRect.height, 3, hexToRgba(rarityColor));

  // Title - Simplified to just the tier reward
  renderer.drawText({
    text: `TIER ${state.tier} REWARD`,
    x: modalRect.x + (modalRect.width / 2),
    y: modalRect.y + (modalRect.height / 2) - 10,
    font: MODAL_TITLE_FONT,
    color: rarityColor,
    align: 'center',
    baseline: 'middle'
  });

  // OK Button
  drawButton(okRect, 'OK', {
    active: true,
    activeSurface: COLORS.button.surface.active,
    inactiveSurface: COLORS.button.surface.inactive,
    activeBorder: COLORS.button.border.active,
    inactiveBorder: COLORS.button.border.inactive
  });

  return layout;
}

export function resolveRewardModalAction(layout: RewardModalLayout, x: number, y: number): boolean {
  if (!layout) return false;
  const { okRect } = layout;
  return x >= okRect.x && x <= okRect.x + okRect.width && y >= okRect.y && y <= okRect.y + okRect.height;
}

function drawRectOutline(
  renderer: any,
  x: number,
  y: number,
  width: number,
  height: number,
  borderWidth: number,
  color: [number, number, number, number] | readonly [number, number, number, number]
) {
  const stroke = Math.max(1, borderWidth);
  renderer.drawRect({ x, y, width, height: stroke, color });
  renderer.drawRect({ x, y: y + height - stroke, width, height: stroke, color });
  renderer.drawRect({ x, y, width: stroke, height, color });
  renderer.drawRect({ x: x + width - stroke, y, width: stroke, height, color });
}


