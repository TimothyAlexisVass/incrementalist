import { COLORS } from '../../colors';
import { InteractionState } from './interactions';
import { getActiveWebGLRenderer } from '../../renderer/webgl';

export interface Modal {
  render(canvas: HTMLCanvasElement, input: InteractionState): void;
  tick(dt: number, input: InteractionState): void;
  backdropAlpha?: number;
  closeOnMenuButton?: boolean;
}

export class Modals {
  private activeModal: Modal | null = null;

  open(modal: Modal) {
    this.activeModal = modal;
  }

  close() {
    this.activeModal = null;
  }

  getActiveModal(): Modal | null {
    return this.activeModal;
  }

  isOpen(): boolean {
    return this.activeModal !== null;
  }

  render(canvas: HTMLCanvasElement, input: InteractionState) {
    if (!this.activeModal) return;

    const renderer = getActiveWebGLRenderer();

    renderer.drawRect({
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
      color: cssToRgba(COLORS.overlay.backdrop, this.activeModal.backdropAlpha)
    });

    this.activeModal.render(canvas, input);
  }

  tick(dt: number, input: InteractionState) {
    if (this.activeModal) {
      this.activeModal.tick(dt, input);
    }
  }
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
      clamp01(overrideAlpha ?? 1)
    ];
  }

  const rgbaMatch = normalized.match(/^rgba?\(([^)]+)\)$/);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map((part) => Number(part.trim()));
    if (parts.length >= 3) {
      const alpha = overrideAlpha !== undefined ? clamp01(overrideAlpha) : (parts.length >= 4 ? clamp01(parts[3]) : 1);
      return [
        clamp01(parts[0] / 255),
        clamp01(parts[1] / 255),
        clamp01(parts[2] / 255),
        alpha
      ];
    }
  }

  return [1, 1, 1, clamp01(overrideAlpha ?? 1)];
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
