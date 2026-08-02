import {
  DISPLAY_AREA_HEIGHT,
  DISPLAY_AREA_WIDTH,
  DISPLAY_AREA_X,
  DISPLAY_AREA_Y,
  MODAL_TITLE_FONT,
  MODAL_BODY_FONT
} from "../../../config";
import type { InteractionState } from "../../../ui/managers/interactions";
import type { Modal } from "../../../ui/managers/modals";
import type { GameChannel } from "../../../net/game-channel";
import type { PlotState } from "../../../net/protocol";
import {
  unlockPlot,
  plantSeed,
  harvestPlot
} from "../../../net/commands";
import { COLORS } from "../../../colors";
import { drawButton, doButton } from "../../../ui/components/button";
import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { toNumber } from "../../../core/bignum";
import { formatBigNum } from "../../../utils/format";
import { resolveStableText, resolveStableMultilineText } from "../../../renderer/stable-text";
import {
  getOrchardViewModel,
  orchardHexPoints,
  orchardHexState
} from "./view-model";
import { humanizeSystemKey } from "./names";
import orchardPlantsConfig from "../../../../../shared/requirements/plants.json";

export function handleOrchardInteractions(
  input: InteractionState,
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => Promise<any> | void,
  blocked: boolean = false
) {
  if (blocked || input.consumed || !input.clicked || !input.pointer) {
    return;
  }

  const orchard = getOrchardViewModel();

  for (const hex of orchard.hexagons) {
    const vertices = orchardHexPoints(hex).map((point) => [
      DISPLAY_AREA_X + point[0] * DISPLAY_AREA_WIDTH,
      DISPLAY_AREA_Y + point[1] * DISPLAY_AREA_HEIGHT
    ] as const);

    if (isPointInPolygon(input.pointer.x, input.pointer.y, vertices)) {
      const stateVal = orchardHexState(hex);
      if (stateVal === "locked") {
        if (channel && runCommand) {
          plotUnlockModal(channel, runCommand, hex.id);
        }
      } else {
        if (channel && runCommand) {
          plotActionModal(channel, runCommand, hex.id, hex.plotData);
        }
      }
      input.consumed = true;
      break;
    }
  }
}

export class PlotUnlockModal implements Modal {
  public readonly isBlocking = true;
  private yesRect = { x: 0, y: 0, width: 120, height: 38 };
  private noRect = { x: 0, y: 0, width: 120, height: 38 };

  constructor(
    private readonly plotId: string,
    private readonly price: number,
    private readonly onConfirm: () => void,
    private readonly onCancel: () => void
  ) {}

  render(canvas: HTMLCanvasElement, input: InteractionState) {
    const renderer = getActiveWebGLRenderer();
    if (!renderer) return;

    const modalWidth = 400;
    const modalHeight = 200;
    const modalX = (canvas.width - modalWidth) / 2;
    const modalY = (canvas.height - modalHeight) / 2;

    renderer.drawRect({
      x: modalX,
      y: modalY,
      width: modalWidth,
      height: modalHeight,
      color: cssToRgba(COLORS.panel.bg)
    });
    drawRectOutline(renderer, modalX, modalY, modalWidth, modalHeight, 2, cssToRgba(COLORS.overlay.panelBorder));

    renderer.drawText({
      text: "Unlock Plot",
      x: modalX + modalWidth / 2,
      y: modalY + 28,
      font: MODAL_TITLE_FONT,
      color: COLORS.overlay.titleText,
      align: "center",
      baseline: "top"
    });

    const body = `Do you want to unlock ${humanizePlotId(this.plotId)}\nfor ${this.price} Shards?`;
    const lines = body.split("\n");
    lines.forEach((line, index) => {
      renderer.drawText({
        text: line,
        x: modalX + modalWidth / 2,
        y: modalY + 70 + index * 20,
        font: MODAL_BODY_FONT,
        color: COLORS.overlay.bodyText,
        align: "center",
        baseline: "top"
      });
    });

    // Button positions
    const btnY = modalY + modalHeight - 56;
    this.yesRect.x = modalX + modalWidth / 2 - 130;
    this.yesRect.y = btnY;
    this.noRect.x = modalX + modalWidth / 2 + 10;
    this.noRect.y = btnY;

    const yesClicked = doButton(input, this.yesRect, "Unlock", {
      activeSurface: COLORS.button.surface.active,
      inactiveSurface: COLORS.button.surface.inactive
    });
    if (yesClicked) {
      this.onConfirm();
    }

    const noClicked = doButton(input, this.noRect, "Cancel", {
      activeSurface: COLORS.button.secondary.surface,
      inactiveSurface: COLORS.button.secondary.surface,
      activeBorder: COLORS.button.secondary.border,
      inactiveBorder: COLORS.button.secondary.border,
      textColor: COLORS.button.secondary.text
    });
    if (noClicked) {
      this.onCancel();
    }
  }

  tick(_dt: number, _input: InteractionState) {}
}

export class PlotActionModal implements Modal {
  public readonly isBlocking = true;
  
  // Rects for buttons
  private okRect = { x: 0, y: 0, width: 120, height: 34 };
  private cancelRect = { x: 0, y: 0, width: 120, height: 34 };
  
  // Empty plot buttons
  private cloverBtnRect = { x: 0, y: 0, width: 320, height: 38 };
  private acornBtnRect = { x: 0, y: 0, width: 320, height: 38 };
  private coinTreeBtnRect = { x: 0, y: 0, width: 320, height: 38 };

  // Harvestable plot buttons
  private burnBtnRect = { x: 0, y: 0, width: 185, height: 42 };
  private decompBtnRect = { x: 0, y: 0, width: 185, height: 42 };

  constructor(
    private readonly plotId: string,
    private readonly plotData: PlotState | null | undefined,
    private readonly onPlant: (seedId: string) => void,
    private readonly onHarvest: (action: "burn" | "decompose") => void,
    private readonly onClose: () => void
  ) {}

  render(canvas: HTMLCanvasElement, input: InteractionState) {
    const renderer = getActiveWebGLRenderer();
    if (!renderer) return;

    const app = (window as any).app;
    const snapshot = app?.store?.state?.snapshot;

    const cloverSeeds = snapshot?.state?.clover_seeds ? toNumber(snapshot.state.clover_seeds) : 0;
    const acorns = snapshot?.state?.acorns ? toNumber(snapshot.state.acorns) : 0;
    const coinTreeSeeds = snapshot?.state?.coin_tree_seeds ? toNumber(snapshot.state.coin_tree_seeds) : 0;

    let modalWidth = 400;
    let modalHeight = 240;

    if (!this.plotData || (!this.plotData.plant && !this.plotData.decomposition)) {
      // Empty plot
      modalWidth = 420;
      modalHeight = 320;
    } else if (this.plotData.plant && this.plotData.plant.growth >= 100.0) {
      // Harvestable plot
      modalWidth = 440;
      modalHeight = 360;
    }

    const modalX = (canvas.width - modalWidth) / 2;
    const modalY = (canvas.height - modalHeight) / 2;

    renderer.drawRect({
      x: modalX,
      y: modalY,
      width: modalWidth,
      height: modalHeight,
      color: cssToRgba(COLORS.panel.bg)
    });
    drawRectOutline(renderer, modalX, modalY, modalWidth, modalHeight, 2, cssToRgba(COLORS.overlay.panelBorder));

    renderer.drawText({
      text: humanizePlotId(this.plotId),
      x: modalX + modalWidth / 2,
      y: modalY + 24,
      font: MODAL_TITLE_FONT,
      color: COLORS.overlay.titleText,
      align: "center",
      baseline: "top"
    });

    if (!this.plotData || (!this.plotData.plant && !this.plotData.decomposition)) {
      // --- Empty Plot ---
      renderer.drawText({
        text: "Select a seed to plant:",
        x: modalX + modalWidth / 2,
        y: modalY + 60,
        font: MODAL_BODY_FONT,
        color: COLORS.overlay.bodyText,
        align: "center",
        baseline: "top"
      });

      const btnX = modalX + (modalWidth - 320) / 2;
      this.cloverBtnRect = { x: btnX, y: modalY + 90, width: 320, height: 38 };
      this.acornBtnRect = { x: btnX, y: modalY + 140, width: 320, height: 38 };
      this.coinTreeBtnRect = { x: btnX, y: modalY + 190, width: 320, height: 38 };

      // Clover Seeds Button
      const cloverLabel = `${humanizeSystemKey("clover_patch")} (Cost: 50, Have: ${cloverSeeds})`;
      const cloverClicked = doButton(input, this.cloverBtnRect, cloverLabel, {
        activeSurface: cloverSeeds >= 50 ? COLORS.button.surface.active : COLORS.button.surface.inactive,
        inactiveSurface: cloverSeeds >= 50 ? COLORS.button.surface.inactive : COLORS.button.secondary.surface,
        textColor: cloverSeeds >= 50 ? COLORS.button.text : COLORS.panel.textDisabled
      });
      if (cloverClicked && cloverSeeds >= 50) {
        this.onPlant("clover_seeds");
      }

      // Acorn Button
      const acornLabel = `${humanizeSystemKey("acorn")} (Cost: 1, Have: ${acorns})`;
      const acornClicked = doButton(input, this.acornBtnRect, acornLabel, {
        activeSurface: acorns >= 1 ? COLORS.button.surface.active : COLORS.button.surface.inactive,
        inactiveSurface: acorns >= 1 ? COLORS.button.surface.inactive : COLORS.button.secondary.surface,
        textColor: acorns >= 1 ? COLORS.button.text : COLORS.panel.textDisabled
      });
      if (acornClicked && acorns >= 1) {
        this.onPlant("acorn");
      }

      // Coin Tree Button
      const coinTreeLabel = `${humanizeSystemKey("coin_tree_seed")} (Cost: 1, Have: ${coinTreeSeeds})`;
      const coinTreeClicked = doButton(input, this.coinTreeBtnRect, coinTreeLabel, {
        activeSurface: coinTreeSeeds >= 1 ? COLORS.button.surface.active : COLORS.button.surface.inactive,
        inactiveSurface: coinTreeSeeds >= 1 ? COLORS.button.surface.inactive : COLORS.button.secondary.surface,
        textColor: coinTreeSeeds >= 1 ? COLORS.button.text : COLORS.panel.textDisabled
      });
      if (coinTreeClicked && coinTreeSeeds >= 1) {
        this.onPlant("coin_tree_seed");
      }

      // Cancel button at bottom
      this.cancelRect = { x: modalX + (modalWidth - 120) / 2, y: modalY + 270, width: 120, height: 34 };
      const cancelClicked = doButton(input, this.cancelRect, "Close", {
        activeSurface: COLORS.button.secondary.surface,
        inactiveSurface: COLORS.button.secondary.surface,
        activeBorder: COLORS.button.secondary.border,
        inactiveBorder: COLORS.button.secondary.border,
        textColor: COLORS.button.secondary.text
      });
      if (cancelClicked) {
        this.onClose();
      }

    } else if (this.plotData.plant) {
      const plant = this.plotData.plant;
      const isReady = plant.growth >= 100.0;

      if (isReady) {
        // --- Harvestable ---
        const spec = (orchardPlantsConfig as any)[plant.plant_id];
        const sizeVal = toNumber(spec.size);
        let woodVal = 0;
        let pmVal = sizeVal;
        if (spec.plantType === "tree") {
          woodVal = Math.floor(sizeVal * 0.9);
          pmVal = Math.floor(sizeVal * 0.1);
        } else if (spec.plantType === "bush") {
          woodVal = Math.floor(sizeVal * 0.4);
          pmVal = Math.floor(sizeVal * 0.6);
        }

        const seedKeys = Object.keys(spec.seedAmount || {}).map(Number);
        const minSeeds = Math.min(...seedKeys);
        const maxSeeds = Math.max(...seedKeys);
        const seedLabel = humanizeSystemKey(spec.seed);
        const seedsDisplay = minSeeds === maxSeeds ? `${minSeeds}` : `${minSeeds}-${maxSeeds}`;

        const yieldLines = [
          `• ${seedLabel}: +${seedsDisplay}`
        ];
        if (woodVal > 0) {
          yieldLines.push(`• Wood: +${woodVal}`);
        }
        if (spec.harvestType === "resource") {
          const minCoins = toNumber(spec.harvestAmount.min);
          const maxCoins = toNumber(spec.harvestAmount.max);
          yieldLines.push(`• Coins: +${minCoins}-${maxCoins}`);
        }

        renderer.drawText({
          text: "The plant is fully grown and ready to harvest!",
          x: modalX + modalWidth / 2,
          y: modalY + 55,
          font: MODAL_BODY_FONT,
          color: COLORS.overlay.bodyText,
          align: "center",
          baseline: "top"
        });

        renderer.drawText({
          text: "Harvest Yields (Added to inventory):",
          x: modalX + 35,
          y: modalY + 85,
          font: MODAL_BODY_FONT,
          color: COLORS.overlay.titleText,
          align: "left",
          baseline: "top"
        });

        yieldLines.forEach((line, index) => {
          renderer.drawText({
            text: line,
            x: modalX + 50,
            y: modalY + 110 + index * 20,
            font: MODAL_BODY_FONT,
            color: COLORS.overlay.bodyText,
            align: "left",
            baseline: "top"
          });
        });

        const biomassY = modalY + 110 + yieldLines.length * 20 + 10;
        renderer.drawText({
          text: `Leftover biomass (${pmVal} Plant Matter):`,
          x: modalX + modalWidth / 2,
          y: biomassY,
          font: MODAL_BODY_FONT,
          color: COLORS.overlay.titleText,
          align: "center",
          baseline: "top"
        });

        const btnY = biomassY + 30;
        this.burnBtnRect = { x: modalX + 25, y: btnY, width: 185, height: 42 };
        this.decompBtnRect = { x: modalX + modalWidth - 210, y: btnY, width: 185, height: 42 };

        const burnClicked = doButton(input, this.burnBtnRect, "Burn (Clear Plot)", {
          activeSurface: COLORS.button.surface.active,
          inactiveSurface: COLORS.button.surface.inactive
        });
        if (burnClicked) {
          this.onHarvest("burn");
        }

        const decompClicked = doButton(input, this.decompBtnRect, "Decompose (Occupies Plot)", {
          activeSurface: COLORS.button.surface.active,
          inactiveSurface: COLORS.button.surface.inactive
        });
        if (decompClicked) {
          this.onHarvest("decompose");
        }

        this.cancelRect = { x: modalX + (modalWidth - 120) / 2, y: btnY + 60, width: 120, height: 34 };
        const cancelClicked = doButton(input, this.cancelRect, "Close", {
          activeSurface: COLORS.button.secondary.surface,
          inactiveSurface: COLORS.button.secondary.surface,
          activeBorder: COLORS.button.secondary.border,
          inactiveBorder: COLORS.button.secondary.border,
          textColor: COLORS.button.secondary.text
        });
        if (cancelClicked) {
          this.onClose();
        }
      } else {
        // --- Growing ---
        const plantName = humanizeSystemKey(plant.plant_id);

        const lines = resolveStableMultilineText(
          `orchard.plot.${this.plotData.id}.plant.details`,
          [
            `Plant: ${plantName}`,
            `Growth: ${plant.growth.toFixed(1)}%`,
            `Level: ${plant.level}`
          ],
          {
            font: MODAL_BODY_FONT,
            color: COLORS.overlay.bodyText,
            align: "center",
            baseline: "top"
          }
        );

        lines.forEach((line, index) => {
          renderer.drawText({
            text: line,
            x: modalX + modalWidth / 2,
            y: modalY + 70 + index * 24,
            font: MODAL_BODY_FONT,
            color: COLORS.overlay.bodyText,
            align: "center",
            baseline: "top"
          });
        });

        // OK button at bottom
        this.okRect = { x: modalX + (modalWidth - 120) / 2, y: modalY + 175, width: 120, height: 34 };
        const okClicked = doButton(input, this.okRect, "OK", {
          activeSurface: COLORS.button.surface.active,
          inactiveSurface: COLORS.button.surface.inactive
        });
        if (okClicked) {
          this.onClose();
        }
      }

    } else if (this.plotData.decomposition) {
      // --- Composting ---
      const decomp = this.plotData.decomposition;
      const resourceName = decomp.resource_id === "fruit" ? "Fruit Pile" : "Plant Matter";

      const lines = [
        `Composting: ${resourceName}`,
        `Progress: ${decomp.progress.toFixed(1)}%`,
        `Amount: ${formatBigNum(decomp.amount)}`
      ];

      lines.forEach((line, index) => {
        renderer.drawText({
          text: line,
          x: modalX + modalWidth / 2,
          y: modalY + 68 + index * 22,
          font: MODAL_BODY_FONT,
          color: COLORS.overlay.bodyText,
          align: "center",
          baseline: "top"
        });
      });

      // OK button at bottom
      this.okRect = { x: modalX + (modalWidth - 120) / 2, y: modalY + 165, width: 120, height: 34 };
      const okClicked = doButton(input, this.okRect, "OK", {
        activeSurface: COLORS.button.surface.active,
        inactiveSurface: COLORS.button.surface.inactive
      });
      if (okClicked) {
        this.onClose();
      }
    }
  }

  tick(_dt: number, _input: InteractionState) {}
}

export function plotUnlockModal(
  channel: GameChannel,
  runCommand: (cmd: () => Promise<any>) => Promise<any> | void,
  plotId: string
) {
  const match = plotId.match(/^plot_(\d+)$/);
  const plotIdNum = match ? parseInt(match[1], 10) : 0;
  const price = 100 * plotIdNum;

  const app = (window as any).app;
  if (app && app.ui && app.ui.modals) {
    app.ui.modals.open(
      new PlotUnlockModal(
        plotId,
        price,
        () => {
          runCommand(() => unlockPlot(channel, plotId));
          app.ui.modals.close();
        },
        () => {
          app.ui.modals.close();
        }
      )
    );
  }
}

export function plotActionModal(
  channel: GameChannel,
  runCommand: (cmd: () => Promise<any>) => Promise<any> | void,
  plotId: string,
  plotData: PlotState | null | undefined
) {
  const app = (window as any).app;
  if (app && app.ui && app.ui.modals) {
    app.ui.modals.open(
      new PlotActionModal(
        plotId,
        plotData,
        (seedId) => {
          runCommand(() => plantSeed(channel, plotId, seedId));
          app.ui.modals.close();
        },
        (action) => {
          runCommand(() => harvestPlot(channel, plotId, action));
          app.ui.modals.close();
        },
        () => {
          app.ui.modals.close();
        }
      )
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

function cssToRgba(color: string, overrideAlpha?: number): [number, number, number, number] {
  const normalized = String(color || '').trim().toLowerCase();
  if (!normalized) return [0, 0, 0, 0];

  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const raw = hexMatch[1];
    const hex = raw.length === 3
      ? `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`
      : raw;
    const value = Number.parseInt(hex, 16);
    return [
      ((value >> 16) & 255) / 255,
      ((value >> 8) & 255) / 255,
      (value & 255) / 255,
      overrideAlpha ?? 1
    ];
  }

  return [1, 1, 1, overrideAlpha ?? 1];
}

function drawRectOutline(
  renderer: any,
  x: number,
  y: number,
  width: number,
  height: number,
  borderWidth: number,
  color: [number, number, number, number]
) {
  const stroke = Math.max(1, Number.isFinite(borderWidth) ? borderWidth : 1);
  renderer.drawRect({ x, y, width, height: stroke, color });
  renderer.drawRect({ x, y: y + height - stroke, width, height: stroke, color });
  renderer.drawRect({ x, y, width: stroke, height, color });
  renderer.drawRect({ x: x + width - stroke, y, width: stroke, height, color });
}
