import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./config";
import { initWebGLEffectsLayer, resizeWebGLEffectsLayer } from "./render/webgl-effects";
import { GameClient } from "./core/game-client";
import { createWebGLRenderer, setActiveWebGLRenderer } from "./renderer/webgl";

const incrementalistCanvas = requiredElement<HTMLCanvasElement>("#incrementalist");
const effectsCanvas = requiredElement<HTMLCanvasElement>("#effects-canvas");
const incrementalistGlContext = incrementalistCanvas.getContext("webgl2", {
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

const app = new GameClient(incrementalistCanvas);
app.start();
app.boot().catch(() => {
  // Boot errors are handled internally by GameClient.
});

function resizeGameCanvases() {
  if (incrementalistCanvas.width !== CANVAS_WIDTH) incrementalistCanvas.width = CANVAS_WIDTH;
  if (incrementalistCanvas.height !== CANVAS_HEIGHT) incrementalistCanvas.height = CANVAS_HEIGHT;
  incrementalistRenderer.resize(incrementalistCanvas.width, incrementalistCanvas.height);
  if (effectsCanvas.width !== CANVAS_WIDTH) effectsCanvas.width = CANVAS_WIDTH;
  if (effectsCanvas.height !== CANVAS_HEIGHT) effectsCanvas.height = CANVAS_HEIGHT;
  resizeWebGLEffectsLayer(effectsCanvas.width, effectsCanvas.height);
}

function requiredElement<TElement extends Element>(selector: string) {
  const element = document.querySelector<TElement>(selector);
  if (!element) throw new Error(`Game shell is missing required element: ${selector}`);
  return element;
}
