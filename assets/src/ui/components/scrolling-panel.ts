import { WebGLRenderer } from '../../renderer/webgl';
import { InteractionState, pointInRect } from '../managers/interactions';

export interface ScrollRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScrollingPanelOptions {
  rect: ScrollRect;
  contentHeight: number;
  scrollBarWidth?: number;
  scrollBarPadding?: number;
}

const SCROLL_DRAG_THRESHOLD_PX = 6;
const SCROLL_BAR_MIN_HEIGHT_PX = 24;
const SCROLL_BAR_COLOR: readonly [number, number, number, number] = [1, 1, 1, 0.26];

export class ScrollingPanel {
  public rect: ScrollRect;
  private contentHeight: number;
  private readonly scrollBarWidth: number;
  private readonly scrollBarPadding: number;
  private scrollY = 0;
  private isDragging = false;
  private lastPointerY = 0;

  constructor(options: ScrollingPanelOptions) {
    this.rect = options.rect;
    this.contentHeight = options.contentHeight;
    this.scrollBarWidth = options.scrollBarWidth ?? 4;
    this.scrollBarPadding = options.scrollBarPadding ?? 2;
  }

  public update(input: InteractionState) {
    this.clampScroll();

    const pointerInside = pointInRect(input.pointer, this.rect);
    if (pointerInside && input.wheelDelta !== 0 && !input.consumed) {
      this.scrollY += input.wheelDelta;
      this.clampScroll();
      input.consumed = true;
    }

    if (!input.isPressed) {
      this.isDragging = false;
      return;
    }

    if (!input.pointer || !input.pressStartPointer) {
      return;
    }

    const startedInside = pointInRect(input.pressStartPointer, this.rect);
    if (!startedInside) {
      return;
    }

    if (!this.isDragging) {
      const totalDeltaY = input.pointer.y - input.pressStartPointer.y;
      if (Math.abs(totalDeltaY) < SCROLL_DRAG_THRESHOLD_PX) {
        return;
      }
      this.isDragging = true;
      this.lastPointerY = input.pointer.y;
    }

    const deltaY = input.pointer.y - this.lastPointerY;
    if (deltaY !== 0) {
      this.scrollY -= deltaY;
    }
    this.lastPointerY = input.pointer.y;
    this.clampScroll();
    input.consumed = true;
  }

  public setRect(rect: ScrollRect) {
    this.rect = rect;
    this.clampScroll();
  }

  private clampScroll() {
    const maxScroll = Math.max(0, this.contentHeight - this.rect.height);
    if (this.scrollY < 0) {
      this.scrollY = 0;
    } else if (this.scrollY > maxScroll) {
      this.scrollY = maxScroll;
    }
  }

  public getScrollOffset(): number {
    return this.scrollY;
  }

  public setContentHeight(height: number) {
    this.contentHeight = Math.max(0, height);
    this.clampScroll();
  }

  public drawClippedContent(renderer: WebGLRenderer, drawContent: (scrollOffsetY: number) => void) {
    renderer.withScissorRect(this.rect, () => {
      drawContent(this.scrollY);
    });
  }

  public drawScrollBar(renderer: WebGLRenderer) {
    if (this.contentHeight <= this.rect.height) return;

    const scrollableHeight = this.contentHeight - this.rect.height;
    const scrollPercentage = scrollableHeight <= 0 ? 0 : this.scrollY / scrollableHeight;
    const barHeight = Math.max(
      SCROLL_BAR_MIN_HEIGHT_PX,
      (this.rect.height / this.contentHeight) * this.rect.height
    );
    const barTravel = Math.max(0, this.rect.height - barHeight);
    const barY = this.rect.y + (scrollPercentage * barTravel);
    const barX = this.rect.x + this.rect.width - this.scrollBarPadding - this.scrollBarWidth;

    renderer.drawRect({
      x: barX,
      y: barY,
      width: this.scrollBarWidth,
      height: barHeight,
      color: SCROLL_BAR_COLOR
    });
  }
}
