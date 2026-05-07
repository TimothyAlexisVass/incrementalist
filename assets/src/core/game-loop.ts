export type FrameCallback = (dt: number) => void;

export class GameLoop {
  private frame = 0;
  private lastTime = 0;

  constructor(private readonly callback: FrameCallback) {}

  start() {
    const tick = (time: number) => {
      const dt = this.lastTime ? time - this.lastTime : 0;
      this.lastTime = time;
      this.callback(dt);
      this.frame = window.requestAnimationFrame(tick);
    };

    this.frame = window.requestAnimationFrame(tick);
  }

  stop() {
    if (this.frame) window.cancelAnimationFrame(this.frame);
    this.lastTime = 0;
  }
}
