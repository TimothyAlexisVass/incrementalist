import { renderSageArea } from './sage/render.js';
import { renderCloverfieldArea } from './cloverfield/render.js';
import { renderMarketArea } from './market/render.js';

export function renderAreaSpecifics(ctx, canvas, state) {
  if (state.area === 'sage') {
    renderSageArea(ctx, canvas, state);
  } else if (state.area === 'cloverfield') {
    renderCloverfieldArea(ctx, canvas, state);
  } else if (state.area === 'market') {
    renderMarketArea(ctx, canvas, state);
  }
}
