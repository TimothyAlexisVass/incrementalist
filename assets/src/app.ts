import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./config";
import { initMainCanvasParticles } from "./render/webgl-effects";
import { GameClient } from "./core/game-client";
import { createWebGLRenderer, setActiveWebGLRenderer } from "./renderer/webgl";
import { setTooltipRenderTarget } from "./ui/components/tooltip";

const incrementalistCanvas = requiredElement<HTMLCanvasElement>("#incrementalist");
const tooltipCanvas = requiredElement<HTMLCanvasElement>("#tooltip-canvas");
const incrementalistRenderer = createCanvasRenderer(incrementalistCanvas);
setActiveWebGLRenderer(incrementalistRenderer);
const tooltipRenderer = createCanvasRenderer(tooltipCanvas);
setTooltipRenderTarget(tooltipCanvas, tooltipRenderer);

// Initialize canvas sizes and the WebGL effects layer.
resizeGameCanvases();
initMainCanvasParticles(incrementalistRenderer.glContext);
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
  if (tooltipCanvas.width !== CANVAS_WIDTH) tooltipCanvas.width = CANVAS_WIDTH;
  if (tooltipCanvas.height !== CANVAS_HEIGHT) tooltipCanvas.height = CANVAS_HEIGHT;
  tooltipRenderer.resize(tooltipCanvas.width, tooltipCanvas.height);
}

function createCanvasRenderer(canvas: HTMLCanvasElement) {
  const glContext = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    stencil: false
  });
  if (!glContext) throw new Error(`Game shell is missing required WebGL context for #${canvas.id}`);
  const gl = glContext;
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return createWebGLRenderer({
    canvas,
    gl
  });
}

function requiredElement<TElement extends Element>(selector: string) {
  const element = document.querySelector<TElement>(selector);
  if (!element) throw new Error(`Game shell is missing required element: ${selector}`);
  return element;
}
