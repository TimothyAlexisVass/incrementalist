export interface Overlay {
  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void;
  handleInput(event: Event, point: { x: number; y: number } | null): boolean;
  tick(dt: number): void;
}

export class OverlayManager {
  private activeOverlay: Overlay | null = null;

  open(overlay: Overlay) {
    this.activeOverlay = overlay;
  }

  close() {
    this.activeOverlay = null;
  }
  
  toggle(overlay: Overlay) {
    if (this.activeOverlay === overlay) {
      this.close();
    } else {
      this.open(overlay);
    }
  }

  isOpen(): boolean {
    return this.activeOverlay !== null;
  }

  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    if (!this.activeOverlay) return;

    // Overlays can optionally draw their own backdrop, but typically they do.
    // For now we assume the overlay handles its own background/backdrop.
    this.activeOverlay.render(ctx, canvas);
  }

  handleInput(event: Event, point: { x: number; y: number } | null): boolean {
    if (!this.activeOverlay) return false;
    
    // We pass input to the overlay. The overlay itself might decide if it consumes the input.
    // Usually, an open overlay blocks game interaction.
    this.activeOverlay.handleInput(event, point);
    return true; 
  }

  tick(dt: number) {
    if (this.activeOverlay) {
      this.activeOverlay.tick(dt);
    }
  }
}
