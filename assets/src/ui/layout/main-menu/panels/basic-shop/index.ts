import { InteractionState } from '../../../../managers/interactions';
import { clearShopHighlight, ServerState } from '../../../../../net/snapshots';
import { Rect } from '../../../../components/tab-menu/tab-menu';
import { getShopViewModel } from './view-model';
import { drawShopPanel } from './render';
import { handleShopInteractions, ShopActions } from './interactions';

export type { ShopActions };

export function renderBasicShopTab(
  ctx: CanvasRenderingContext2D,
  _canvas: HTMLCanvasElement,
  input: InteractionState,
  state: ServerState,
  rect: Rect,
  actions: ShopActions
) {
  const viewModel = getShopViewModel(state);
  
  // 1. Handle interactions first (might mutate input.consumed)
  handleShopInteractions(input, rect, viewModel, actions, () => clearShopHighlight(state));
  
  // 2. Draw the panel
  drawShopPanel(ctx, rect, viewModel);
}
