import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./config";
import { initWebGLEffectsLayer, resizeWebGLEffectsLayer } from "./render/webgl-effects";
import { GameClient } from "./core/game-client";
import { createWebGLRenderer, setActiveWebGLRenderer } from "./renderer/webgl";

const canvas = requiredElement<HTMLCanvasElement>("#game-canvas");
const incrementalistCanvas = requiredElement<HTMLCanvasElement>("#incrementalist");
const effectsCanvas = requiredElement<HTMLCanvasElement>("#effects-canvas");
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Game shell is missing required 2d context");
const incrementalistGlContext = incrementalistCanvas.getContext("webgl", {
  alpha: true,
  antialias: false,
  depth: false,
  premultipliedAlpha: false,
  preserveDrawingBuffer: false,
  stencil: false
});
if (!incrementalistGlContext) throw new Error("Game shell is missing required incrementalist WebGL context");
const incrementalistGl = incrementalistGlContext;
incrementalistGl.clearColor(0, 0, 0, 0);
incrementalistGl.clear(incrementalistGl.COLOR_BUFFER_BIT);
const incrementalistRenderer = createWebGLRenderer({
  canvas: incrementalistCanvas,
  gl: incrementalistGl
});
setActiveWebGLRenderer(incrementalistRenderer);

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
  if (incrementalistCanvas.width !== canvas.width) incrementalistCanvas.width = canvas.width;
  if (incrementalistCanvas.height !== canvas.height) incrementalistCanvas.height = canvas.height;
  incrementalistRenderer.resize(incrementalistCanvas.width, incrementalistCanvas.height);
  if (effectsCanvas.width !== canvas.width) effectsCanvas.width = canvas.width;
  if (effectsCanvas.height !== canvas.height) effectsCanvas.height = canvas.height;
  resizeWebGLEffectsLayer(effectsCanvas.width, effectsCanvas.height);
}

function requiredElement<TElement extends Element>(selector: string) {
  const element = document.querySelector<TElement>(selector);
  if (!element) throw new Error(`Game shell is missing required element: ${selector}`);
  return element;
}
