export type FrameCallback = (time: number) => void;

export class GameLoop {
  private frame = 0;

  constructor(private readonly callback: FrameCallback) {}

  start() {
    const tick = (time: number) => {
      this.callback(time);
      this.frame = window.requestAnimationFrame(tick);
    };

    this.frame = window.requestAnimationFrame(tick);
  }

  stop() {
    if (this.frame) window.cancelAnimationFrame(this.frame);
  }
}
