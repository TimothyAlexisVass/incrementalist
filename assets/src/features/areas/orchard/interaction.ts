import {
  DISPLAY_AREA_HEIGHT,
  DISPLAY_AREA_WIDTH,
  DISPLAY_AREA_X,
  DISPLAY_AREA_Y
} from "../../../config";
import type { InteractionState } from "../../../ui/managers/interactions";
import {
  getOrchardViewModel,
  orchardHexPoints,
  orchardHexState
} from "./view-model";
import { InfoAcknowledgementModal } from "../../../ui/components/modals/confirmation-modal";

export function handleOrchardInteractions(
  input: InteractionState,
  blocked: boolean = false
) {
  if (blocked || input.consumed || !input.clicked || !input.pointer) {
    return;
  }

  const orchard = getOrchardViewModel();

  for (const hex of orchard.hexagons) {
    if (orchardHexState(hex) === "unlocked") {
      const vertices = orchardHexPoints(hex).map((point) => [
        DISPLAY_AREA_X + point[0] * DISPLAY_AREA_WIDTH,
        DISPLAY_AREA_Y + point[1] * DISPLAY_AREA_HEIGHT
      ] as const);

      if (isPointInPolygon(input.pointer.x, input.pointer.y, vertices)) {
        plotModal(hex.id);
        input.consumed = true;
        break;
      }
    }
  }
}

export function plotModal(plotId: string) {
  const title = humanizePlotId(plotId);
  const app = (window as any).app;
  if (app && app.ui && app.ui.modals) {
    app.ui.modals.open(
      new InfoAcknowledgementModal(title, "Plot details", () => {
        app.ui.modals.close();
      })
    );
  }
}

function humanizePlotId(plotId: string): string {
  return plotId
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isPointInPolygon(px: number, py: number, polygon: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect = ((yi > py) !== (yj > py))
      && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
