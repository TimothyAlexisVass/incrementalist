import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./config";
import { initWebGLEffectsLayer, resizeWebGLEffectsLayer } from "./render/webgl-effects";
import { GameClient } from "./core/game-client";

const canvas = requiredElement<HTMLCanvasElement>("#game-canvas");
const effectsCanvas = requiredElement<HTMLCanvasElement>("#effects-canvas");
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Game shell is missing required 2d context");

// Initialize canvas sizes and the WebGL effects layer.
resizeGameCanvases();
initWebGLEffectsLayer(effectsCanvas, effectsCanvas.width, effectsCanvas.height);
window.addEventListener("resize", resizeGameCanvases);

const app = new GameClient(canvas, ctx);
app.start();
app.boot().catch(() => {
  // Boot errors are handled internally by GameClient.
});

function resizeGameCanvases() {
  if (canvas.width !== CANVAS_WIDTH) canvas.width = CANVAS_WIDTH;
  if (canvas.height !== CANVAS_HEIGHT) canvas.height = CANVAS_HEIGHT;
  if (effectsCanvas.width !== canvas.width) effectsCanvas.width = canvas.width;
  if (effectsCanvas.height !== canvas.height) effectsCanvas.height = canvas.height;
  resizeWebGLEffectsLayer(effectsCanvas.width, effectsCanvas.height);
}

function requiredElement<TElement extends Element>(selector: string) {
  const element = document.querySelector<TElement>(selector);
  if (!element) throw new Error(`Game shell is missing required element: ${selector}`);
  return element;
}
