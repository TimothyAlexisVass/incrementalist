import { COLORS } from '../colors';

type AnyRecord = Record<string, any>;
export type Rgb = [number, number, number];
export type ColorInput = Rgb | readonly [number, number, number] | string;
type ParticleOptions = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  drag: number;
  size: number;
  color?: ColorInput;
  alpha?: number;
  fadePower?: number;
  gravity?: number;
  lifeMs: number;
};
type LaserRectOptions = {
  originX: number;
  originY: number;
  angle: number;
  baseLength: number;
  growLength: number;
  baseThickness: number;
  growThickness: number;
  travel?: number;
  travelX?: number;
  travelY?: number;
  color?: ColorInput;
  targetColor?: ColorInput;
  alpha?: number;
  delayMs?: number;
  growDurationScale?: number;
  lifeMs?: number;
};
type GpuParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  drag: number;
  size: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
  fadePower: number;
  gravity: number;
  elapsedMs: number;
  lifeMs: number;
};
type GpuLaserRect = {
  originX: number;
  originY: number;
  angle: number;
  baseLength: number;
  growLength: number;
  baseThickness: number;
  growThickness: number;
  travelX: number;
  travelY: number;
  color: Rgb;
  targetColor: Rgb;
  alpha: number;
  delayMs: number;
  elapsedMs: number;
  growDurationScale: number;
  lifeMs: number;
};
type AttributeLocations<T extends string> = Record<T, number>;
type UniformLocations<T extends string> = Record<T, WebGLUniformLocation | null>;

const MAX_GPU_PARTICLES = 4096;
const MAX_GPU_LIQUID_BUBBLES = 96;
const MAX_GPU_LASER_RECTS = 384;
const PARTICLE_FLOATS = 7;
const BUBBLE_FLOATS = 4;
const LASER_RECT_FLOATS = 12;
const LASER_RECT_VERTICES = 6;
const LASER_RECT_LOCAL_POINTS = Object.freeze([
  -1, -1,
  1, -1,
  -1, 1,
  -1, 1,
  1, -1,
  1, 1
]);
const BUBBLE_SIZE = 0.83;
const TWO_PI = Math.PI * 2;

const DEFAULT_CLICK_COLORS = Object.freeze([
  COLORS.rewards.coins,
  COLORS.rewards.shards,
  COLORS.rewards.cores,
  COLORS.rewards.achievement,
  COLORS.rewards.questSummary
]);

const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  attribute float a_size;
  attribute vec4 a_color;

  uniform vec2 u_resolution;

  varying vec4 v_color;

  void main() {
    vec2 zeroToOne = a_position / u_resolution;
    vec2 clipSpace = zeroToOne * 2.0 - 1.0;

    gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
    gl_PointSize = a_size;
    v_color = a_color;
  }
`;

const FRAGMENT_SHADER_SOURCE = `
  precision mediump float;

  varying vec4 v_color;

  void main() {
    vec2 point = gl_PointCoord * 2.0 - 1.0;
    float distanceFromCenter = length(point);

    float core = smoothstep(0.32, 0.0, distanceFromCenter);
    float halo = smoothstep(0.86, 0.12, distanceFromCenter);
    float outerGlow = smoothstep(1.0, 0.35, distanceFromCenter);
    float alpha = (core * 0.95 + halo * 0.52 + outerGlow * 0.2) * v_color.a;
    vec3 color = v_color.rgb * (1.35 + core * 0.95);

    gl_FragColor = vec4(color, alpha);
  }
`;

const BUBBLE_VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  attribute float a_size;
  attribute float a_alpha;

  uniform vec2 u_resolution;

  varying float v_alpha;

  void main() {
    vec2 zeroToOne = a_position / u_resolution;
    vec2 clipSpace = zeroToOne * 2.0 - 1.0;

    gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
    gl_PointSize = a_size;
    v_alpha = a_alpha;
  }
`;

const BUBBLE_FRAGMENT_SHADER_SOURCE = `
  precision mediump float;

  varying float v_alpha;

  void main() {
    vec2 point = gl_PointCoord * 2.0 - 1.0;
    float distanceFromCenter = length(point);

    if (distanceFromCenter > 1.0) {
      discard;
    }

    float shell = smoothstep(1.0, 0.7, distanceFromCenter) * smoothstep(0.42, 0.72, distanceFromCenter);
    float softFill = smoothstep(0.96, 0.0, distanceFromCenter) * 0.18;
    float innerShine = smoothstep(0.82, 0.08, distanceFromCenter) * 0.12;
    float highlight = smoothstep(0.25, 0.0, length(point - vec2(-0.34, -0.38))) * 0.95;
    float alpha = (shell * 1.34 + softFill + innerShine + highlight) * v_alpha;

    gl_FragColor = vec4(vec3(1.0), alpha);
  }
`;

const GLOW_VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;

  uniform vec2 u_resolution;

  varying vec2 v_position;

  void main() {
    vec2 zeroToOne = a_position / u_resolution;
    vec2 clipSpace = zeroToOne * 2.0 - 1.0;

    gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
    v_position = a_position;
  }
`;

const GLOW_FRAGMENT_SHADER_SOURCE = `
  precision mediump float;

  uniform vec4 u_rect;
  uniform vec3 u_color;
  uniform float u_intensity;
  uniform float u_radius;

  varying vec2 v_position;

  void main() {
    vec2 rectMin = u_rect.xy;
    vec2 rectMax = u_rect.xy + u_rect.zw;
    vec2 outsideDelta = max(max(rectMin - v_position, v_position - rectMax), vec2(0.0));
    float outsideDistance = length(outsideDelta);
    float outsideGlow = 1.0 - smoothstep(0.0, u_radius * 1.55, outsideDistance);

    float insideEdge = min(
      min(v_position.x - rectMin.x, rectMax.x - v_position.x),
      min(v_position.y - rectMin.y, rectMax.y - v_position.y)
    );
    float insideGlow = (1.0 - smoothstep(0.0, u_radius * 0.48, insideEdge)) * step(0.0, insideEdge);
    float softBody = 1.0 - smoothstep(0.0, u_radius * 2.0, outsideDistance);
    float alpha = (outsideGlow * 0.78 + insideGlow * 0.32 + softBody * 0.12) * u_intensity;
    vec3 color = u_color * (1.15 + outsideGlow * 0.85);

    gl_FragColor = vec4(color, alpha);
  }
`;

const LASER_RECT_VERTEX_SHADER_SOURCE = `
  attribute vec2 a_center;
  attribute vec2 a_axis;
  attribute vec2 a_perp;
  attribute vec2 a_local;
  attribute vec4 a_color;

  uniform vec2 u_resolution;

  varying vec2 v_local;
  varying vec4 v_color;

  void main() {
    vec2 position = a_center + a_axis * a_local.x + a_perp * a_local.y;
    vec2 zeroToOne = position / u_resolution;
    vec2 clipSpace = zeroToOne * 2.0 - 1.0;

    gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
    v_local = a_local;
    v_color = a_color;
  }
`;

const LASER_RECT_FRAGMENT_SHADER_SOURCE = `
  precision mediump float;

  varying vec2 v_local;
  varying vec4 v_color;

  void main() {
    float dist = max(abs(v_local.x), abs(v_local.y));
    
    // Narrower smoothing for a more defined beam
    float beam = smoothstep(1.0, 0.72, dist);
    float core = smoothstep(0.42, 0.0, dist);
    float bloom = exp(-dist * dist * 3.2);
    
    float alpha = (beam * 0.4 + core * 0.5 + bloom * 0.1) * v_color.a;
    vec3 color = v_color.rgb * (1.1 + core * 1.0 + beam * 0.1);

    gl_FragColor = vec4(color, alpha);
  }
`;

const WEBGL_EFFECTS: {
  canvas: HTMLCanvasElement | null;
  gl: WebGLRenderingContext | null;
  program: WebGLProgram | null;
  bubbleProgram: WebGLProgram | null;
  glowProgram: WebGLProgram | null;
  laserRectProgram: WebGLProgram | null;
  buffer: WebGLBuffer | null;
  bubbleBuffer: WebGLBuffer | null;
  glowBuffer: WebGLBuffer | null;
  laserRectBuffer: WebGLBuffer | null;
  particles: GpuParticle[];
  laserBursts: GpuLaserRect[];
  liquidBubbles: {
    x: number;
    y: number;
    radius: number;
    speed: number;
    phase: number;
    alpha: number;
    ageMs: number;
  }[];
  liquidBubbleSpawnAccumulator: number;
  liquidClipRect: { x: number; y: number; width: number; height: number } | null;
  progressBarGlow: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    intensity: number;
    color: Rgb;
  } | null;
  data: Float32Array;
  bubbleData: Float32Array;
  glowData: Float32Array;
  laserRectData: Float32Array;
  attributes: AttributeLocations<"position" | "size" | "color"> | null;
  bubbleAttributes: AttributeLocations<"position" | "size" | "alpha"> | null;
  glowAttributes: AttributeLocations<"position"> | null;
  laserRectAttributes: AttributeLocations<"center" | "axis" | "perp" | "local" | "color"> | null;
  uniforms: UniformLocations<"resolution"> | null;
  bubbleUniforms: UniformLocations<"resolution"> | null;
  glowUniforms: UniformLocations<"resolution" | "rect" | "color" | "intensity" | "radius"> | null;
  laserRectUniforms: UniformLocations<"resolution"> | null;
  mainGl: WebGLRenderingContext | null;
  mainProgram: WebGLProgram | null;
  mainBuffer: WebGLBuffer | null;
  mainAttributes: AttributeLocations<"position" | "size" | "color"> | null;
  mainUniforms: UniformLocations<"resolution"> | null;
  mainLaserRectProgram: WebGLProgram | null;
  mainLaserRectBuffer: WebGLBuffer | null;
  mainLaserRectAttributes: AttributeLocations<"center" | "axis" | "perp" | "local" | "color"> | null;
  mainLaserRectUniforms: UniformLocations<"resolution"> | null;
  ready: boolean;
} = {
  canvas: null,
  gl: null,
  program: null,
  bubbleProgram: null,
  glowProgram: null,
  laserRectProgram: null,
  buffer: null,
  bubbleBuffer: null,
  glowBuffer: null,
  laserRectBuffer: null,
  particles: [],
  laserBursts: [],
  liquidBubbles: [],
  liquidBubbleSpawnAccumulator: 0,
  liquidClipRect: null,
  progressBarGlow: null,
  data: new Float32Array(MAX_GPU_PARTICLES * PARTICLE_FLOATS),
  bubbleData: new Float32Array(MAX_GPU_LIQUID_BUBBLES * BUBBLE_FLOATS),
  glowData: new Float32Array(12),
  laserRectData: new Float32Array(MAX_GPU_LASER_RECTS * LASER_RECT_VERTICES * LASER_RECT_FLOATS),
  attributes: null,
  bubbleAttributes: null,
  glowAttributes: null,
  laserRectAttributes: null,
  uniforms: null,
  bubbleUniforms: null,
  glowUniforms: null,
  laserRectUniforms: null,
  mainGl: null,
  mainProgram: null,
  mainBuffer: null,
  mainAttributes: null,
  mainUniforms: null,
  mainLaserRectProgram: null,
  mainLaserRectBuffer: null,
  mainLaserRectAttributes: null,
  mainLaserRectUniforms: null,
  ready: false
};

export function initMainCanvasParticles(gl: WebGLRenderingContext) {
  const particleProgram = createProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
  if (!particleProgram) return false;

  const laserProgram = createProgram(gl, LASER_RECT_VERTEX_SHADER_SOURCE, LASER_RECT_FRAGMENT_SHADER_SOURCE);
  if (!laserProgram) return false;

  WEBGL_EFFECTS.mainGl = gl;

  // Particles
  WEBGL_EFFECTS.mainProgram = particleProgram;
  WEBGL_EFFECTS.mainBuffer = gl.createBuffer();
  WEBGL_EFFECTS.mainAttributes = {
    position: gl.getAttribLocation(particleProgram, 'a_position'),
    size: gl.getAttribLocation(particleProgram, 'a_size'),
    color: gl.getAttribLocation(particleProgram, 'a_color')
  };
  WEBGL_EFFECTS.mainUniforms = {
    resolution: gl.getUniformLocation(particleProgram, 'u_resolution')
  };

  // Lasers
  WEBGL_EFFECTS.mainLaserRectProgram = laserProgram;
  WEBGL_EFFECTS.mainLaserRectBuffer = gl.createBuffer();
  WEBGL_EFFECTS.mainLaserRectAttributes = {
    center: gl.getAttribLocation(laserProgram, 'a_center'),
    axis: gl.getAttribLocation(laserProgram, 'a_axis'),
    perp: gl.getAttribLocation(laserProgram, 'a_perp'),
    local: gl.getAttribLocation(laserProgram, 'a_local'),
    color: gl.getAttribLocation(laserProgram, 'a_color')
  };
  WEBGL_EFFECTS.mainLaserRectUniforms = {
    resolution: gl.getUniformLocation(laserProgram, 'u_resolution')
  };

  return true;
}

export function initWebGLEffectsLayer(canvas: HTMLCanvasElement | null, width: number, height: number) {
  if (!canvas) {
    return false;
  }

  WEBGL_EFFECTS.canvas = canvas;
  resizeWebGLEffectsLayer(width, height);

  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    stencil: false
  });

  if (!gl) {
    canvas.hidden = true;
    return false;
  }

  const program = createProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
  if (!program) {
    canvas.hidden = true;
    return false;
  }

  const bubbleProgram = createProgram(gl, BUBBLE_VERTEX_SHADER_SOURCE, BUBBLE_FRAGMENT_SHADER_SOURCE);
  const glowProgram = createProgram(gl, GLOW_VERTEX_SHADER_SOURCE, GLOW_FRAGMENT_SHADER_SOURCE);
  const laserRectProgram = createProgram(gl, LASER_RECT_VERTEX_SHADER_SOURCE, LASER_RECT_FRAGMENT_SHADER_SOURCE);

  WEBGL_EFFECTS.gl = gl;
  WEBGL_EFFECTS.program = program;
  WEBGL_EFFECTS.bubbleProgram = bubbleProgram;
  WEBGL_EFFECTS.glowProgram = glowProgram;
  WEBGL_EFFECTS.laserRectProgram = laserRectProgram;
  WEBGL_EFFECTS.buffer = gl.createBuffer();
  WEBGL_EFFECTS.bubbleBuffer = gl.createBuffer();
  WEBGL_EFFECTS.glowBuffer = gl.createBuffer();
  WEBGL_EFFECTS.laserRectBuffer = gl.createBuffer();
  WEBGL_EFFECTS.attributes = {
    position: gl.getAttribLocation(program, 'a_position'),
    size: gl.getAttribLocation(program, 'a_size'),
    color: gl.getAttribLocation(program, 'a_color')
  };
  WEBGL_EFFECTS.uniforms = {
    resolution: gl.getUniformLocation(program, 'u_resolution')
  };
  WEBGL_EFFECTS.bubbleAttributes = bubbleProgram
    ? {
      position: gl.getAttribLocation(bubbleProgram, 'a_position'),
      size: gl.getAttribLocation(bubbleProgram, 'a_size'),
      alpha: gl.getAttribLocation(bubbleProgram, 'a_alpha')
    }
    : null;
  WEBGL_EFFECTS.bubbleUniforms = bubbleProgram
    ? {
      resolution: gl.getUniformLocation(bubbleProgram, 'u_resolution')
    }
    : null;
  WEBGL_EFFECTS.glowAttributes = glowProgram
    ? {
      position: gl.getAttribLocation(glowProgram, 'a_position')
    }
    : null;
  WEBGL_EFFECTS.glowUniforms = glowProgram
    ? {
      resolution: gl.getUniformLocation(glowProgram, 'u_resolution'),
      rect: gl.getUniformLocation(glowProgram, 'u_rect'),
      color: gl.getUniformLocation(glowProgram, 'u_color'),
      intensity: gl.getUniformLocation(glowProgram, 'u_intensity'),
      radius: gl.getUniformLocation(glowProgram, 'u_radius')
    }
    : null;
  WEBGL_EFFECTS.laserRectAttributes = laserRectProgram
    ? {
      center: gl.getAttribLocation(laserRectProgram, 'a_center'),
      axis: gl.getAttribLocation(laserRectProgram, 'a_axis'),
      perp: gl.getAttribLocation(laserRectProgram, 'a_perp'),
      local: gl.getAttribLocation(laserRectProgram, 'a_local'),
      color: gl.getAttribLocation(laserRectProgram, 'a_color')
    }
    : null;
  WEBGL_EFFECTS.laserRectUniforms = laserRectProgram
    ? {
      resolution: gl.getUniformLocation(laserRectProgram, 'u_resolution')
    }
    : null;
  WEBGL_EFFECTS.ready = true;
  canvas.hidden = false;

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  gl.viewport(0, 0, canvas.width, canvas.height);

  return true;
}

export function resizeWebGLEffectsLayer(width: number, height: number) {
  const canvas = WEBGL_EFFECTS.canvas;
  if (!canvas) return;

  const nextWidth = Math.max(1, Math.floor(Number(width) || canvas.width || 1));
  const nextHeight = Math.max(1, Math.floor(Number(height) || canvas.height || 1));

  if (canvas.width !== nextWidth) {
    canvas.width = nextWidth;
  }

  if (canvas.height !== nextHeight) {
    canvas.height = nextHeight;
  }

  if (WEBGL_EFFECTS.gl) {
    WEBGL_EFFECTS.gl.viewport(0, 0, nextWidth, nextHeight);
  }
}

export function hasWebGLEffectsLayer() {
  return WEBGL_EFFECTS.ready;
}

export function updateWebGLEffects(deltaTime: number) {
  const particles = WEBGL_EFFECTS.particles;
  const laserBursts = WEBGL_EFFECTS.laserBursts;
  if (particles.length === 0 && laserBursts.length === 0) return;

  updateGpuLaserBursts(deltaTime);

  if (particles.length === 0) return;

  const deltaSeconds = deltaTime / 1000;
  let writeIndex = 0;

  for (let i = 0; i < particles.length; i += 1) {
    const particle = particles[i];
    particle.elapsedMs += deltaTime;

    if (particle.elapsedMs >= particle.lifeMs) {
      continue;
    }

    const drag = Math.pow(particle.drag, deltaTime / 16.67);
    particle.vx *= drag;
    particle.vy = particle.vy * drag + (particle.gravity || 0) * deltaSeconds;
    particle.x += particle.vx * deltaSeconds;
    particle.y += particle.vy * deltaSeconds;

    particles[writeIndex] = particle;
    writeIndex += 1;
  }

  particles.length = writeIndex;
}

export interface RenderWebGLOptions {
  visible?: boolean;
  targetCanvas?: HTMLCanvasElement | null;
}

export function renderWebGLEffects(options: RenderWebGLOptions = {}) {
  if (!WEBGL_EFFECTS.ready) return;

  const gl = WEBGL_EFFECTS.gl;
  const particles = WEBGL_EFFECTS.particles;
  const uniforms = WEBGL_EFFECTS.uniforms;
  const visible = options.visible !== false;
  const renderCanvas = options.targetCanvas ?? WEBGL_EFFECTS.canvas;

  if (!gl || !uniforms?.resolution || !renderCanvas) {
    return;
  }

  gl.viewport(0, 0, renderCanvas.width, renderCanvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT);

  if (!visible) {
    return;
  }

  renderProgressBarGlow(gl, renderCanvas.width, renderCanvas.height);
  renderLiquidBubbles(gl, renderCanvas.width, renderCanvas.height);

  const useMain = !!WEBGL_EFFECTS.mainGl;
  const lGl = WEBGL_EFFECTS.mainGl || gl;
  renderLaserBursts(lGl, lGl.canvas.width, lGl.canvas.height, useMain);

  if (particles.length === 0) {
    return;
  }

  const pGl = WEBGL_EFFECTS.mainGl || gl;
  const pProgram = useMain ? WEBGL_EFFECTS.mainProgram : WEBGL_EFFECTS.program;
  const pBuffer = useMain ? WEBGL_EFFECTS.mainBuffer : WEBGL_EFFECTS.buffer;
  const pUniforms = useMain ? WEBGL_EFFECTS.mainUniforms : WEBGL_EFFECTS.uniforms;
  const pAttributes = useMain ? WEBGL_EFFECTS.mainAttributes : WEBGL_EFFECTS.attributes;

  if (!pGl || !pProgram || !pBuffer || !pUniforms || !pAttributes) {
    return;
  }

  const drawCount = Math.min(particles.length, MAX_GPU_PARTICLES);
  const data = WEBGL_EFFECTS.data;
  let offset = 0;

  for (let i = 0; i < drawCount; i += 1) {
    const particle = particles[i];
    const lifeProgress = particle.elapsedMs / particle.lifeMs;
    const alpha = particle.alpha * Math.pow(Math.max(0, 1 - lifeProgress), particle.fadePower);
    const size = particle.size * (0.86 + alpha * 0.34);

    data[offset] = particle.x;
    data[offset + 1] = particle.y;
    data[offset + 2] = size;
    data[offset + 3] = particle.r;
    data[offset + 4] = particle.g;
    data[offset + 5] = particle.b;
    data[offset + 6] = alpha;
    offset += PARTICLE_FLOATS;
  }

  if (useMain) {
    pGl.enable(pGl.BLEND);
    pGl.blendFuncSeparate(pGl.SRC_ALPHA, pGl.ONE, pGl.ONE, pGl.ONE_MINUS_SRC_ALPHA);
  }

  pGl.useProgram(pProgram);
  pGl.bindBuffer(pGl.ARRAY_BUFFER, pBuffer);
  pGl.bufferData(pGl.ARRAY_BUFFER, data.subarray(0, drawCount * PARTICLE_FLOATS), pGl.DYNAMIC_DRAW);

  bindParticleAttributes(pGl, pAttributes);
  pGl.uniform2f(
    pUniforms.resolution,
    pGl.canvas.width,
    pGl.canvas.height
  );
  pGl.drawArrays(pGl.POINTS, 0, drawCount);

  if (useMain) {
    // Restore default blend mode for main renderer
    pGl.blendFunc(pGl.ONE, pGl.ONE_MINUS_SRC_ALPHA);
  }
}

export interface LiquidBubbleOptions {
  barX?: number;
  barY?: number;
  barWidth?: number;
  barHeight?: number;
  fillHeight?: number;
  fillRatio?: number;
  fillY?: number;
}

export function updateGpuProgressLiquidBubbles(deltaTime: number, options: LiquidBubbleOptions = {}) {
  if (!WEBGL_EFFECTS.ready || !WEBGL_EFFECTS.bubbleProgram) {
    return false;
  }

  const barX = Number(options.barX) || 0;
  const barY = Number(options.barY) || 0;
  const barWidth = Math.max(0, Number(options.barWidth) || 0);
  const barHeight = Math.max(0, Number(options.barHeight) || 0);
  const fillHeight = Math.max(0, Number(options.fillHeight) || 0);
  const fillRatio = Math.min(Math.max(Number(options.fillRatio) || 0, 0), 1);
  const fillY = Number(options.fillY) || (barY + barHeight - fillHeight);
  const bubbles = WEBGL_EFFECTS.liquidBubbles;

  if (fillRatio <= 0.02 || fillHeight < 8 || barWidth < 8) {
    bubbles.length = 0;
    WEBGL_EFFECTS.liquidBubbleSpawnAccumulator = 0;
    WEBGL_EFFECTS.liquidClipRect = null;
    return true;
  }

  const clipInset = 3;
  const clipY = Math.max(barY + clipInset, fillY + 1);
  const clipBottom = barY + barHeight - clipInset;
  WEBGL_EFFECTS.liquidClipRect = {
    x: barX + clipInset,
    y: clipY,
    width: Math.max(0, barWidth - clipInset * 2),
    height: Math.max(0, clipBottom - clipY)
  };

  const deltaSeconds = deltaTime / 1000;
  let writeIndex = 0;

  for (let i = 0; i < bubbles.length; i += 1) {
    const bubble = bubbles[i];
    bubble.ageMs += deltaTime;
    bubble.y -= bubble.speed * deltaSeconds;

    if (bubble.y - bubble.radius <= clipY || bubble.y + bubble.radius < barY) {
      continue;
    }

    bubbles[writeIndex] = bubble;
    writeIndex += 1;
  }

  bubbles.length = writeIndex;

  if (fillHeight < 20) return true;

  WEBGL_EFFECTS.liquidBubbleSpawnAccumulator += deltaTime * (0.004 + fillRatio * 0.006);

  while (
    WEBGL_EFFECTS.liquidBubbleSpawnAccumulator >= 1 &&
    bubbles.length < MAX_GPU_LIQUID_BUBBLES
  ) {
    spawnGpuLiquidBubble(barX, barY, barWidth, barHeight, fillHeight, fillRatio);
    WEBGL_EFFECTS.liquidBubbleSpawnAccumulator -= 1;
  }

  return true;
}

export interface ProgressBarGlowOptions {
  active?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  intensity?: number;
  color?: ColorInput;
}

export function setGpuProgressBarGlow(options: ProgressBarGlowOptions = {}) {
  if (!WEBGL_EFFECTS.ready || !WEBGL_EFFECTS.glowProgram) {
    return false;
  }

  if (!options.active) {
    WEBGL_EFFECTS.progressBarGlow = null;
    return true;
  }

  const color = normalizeColor(options.color || [255, 255, 255]);
  WEBGL_EFFECTS.progressBarGlow = {
    x: Number(options.x) || 0,
    y: Number(options.y) || 0,
    width: Math.max(0, Number(options.width) || 0),
    height: Math.max(0, Number(options.height) || 0),
    radius: Math.max(1, Number(options.radius) || 34),
    intensity: Math.min(Math.max(Number(options.intensity) || 0, 0), 1.4),
    color
  };

  return true;
}

export interface GpuClickBurstOptions {
  count?: number;
  colors?: readonly ColorInput[];
}

export function spawnGpuClickBurst(x: number, y: number, options: GpuClickBurstOptions = {}) {
  if (!WEBGL_EFFECTS.ready) {
    return false;
  }

  const count = options.count ?? Math.floor(8 + Math.random() * 7);
  const colors = options.colors || DEFAULT_CLICK_COLORS;

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * TWO_PI;
    const speed = 80 + Math.random() * 180;
    const color = normalizeColor(colors[Math.floor(Math.random() * colors.length)]);
    const radius = 1.5 + Math.random() * 2.7;

    pushGpuParticle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      drag: 0.92 + Math.random() * 0.04,
      size: radius * 9,
      color,
      alpha: 0.9,
      fadePower: 1.35,
      lifeMs: 320 + Math.random() * 260
    });
  }

  trimGpuParticles();
  return true;
}

export function spawnGpuProgressCompletionBurst(
  barX: number,
  barY: number,
  barWidth: number,
  barHeight: number,
  colors: readonly ColorInput[],
  options: AnyRecord = {}
) {
  if (!WEBGL_EFFECTS.ready) {
    return false;
  }

  const countMultiplier = Math.max(1, Number(options.countMultiplier) || 1);
  const gravity = Math.max(0, Number(options.gravity) || 0);
  const lifeMultiplier = Math.max(1, Number(options.lifeMultiplier) || 1);
  const centerX = barX + barWidth / 2;
  const centerY = barY + barHeight / 2;

  for (let i = 0; i < Math.round(54 * countMultiplier); i += 1) {
    const originX = barX + Math.random() * barWidth;
    const originY = barY + Math.random() * barHeight;
    const outwardAngle = Math.atan2(originY - centerY, originX - centerX);
    const angle = outwardAngle + (Math.random() - 0.5) * 0.95;
    const speed = 55 + Math.random() * 155;
    const color = normalizeColor(colors[Math.floor(Math.random() * colors.length)]);

    pushGpuParticle({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      drag: 0.94 + Math.random() * 0.03,
      size: 16 + Math.random() * 18,
      color,
      alpha: 0.96,
      fadePower: 1.2,
      gravity,
      lifeMs: (680 + Math.random() * 620) * lifeMultiplier
    });
  }

  for (let i = 0; i < Math.round(18 * countMultiplier); i += 1) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
    const speed = 90 + Math.random() * 165;
    const color = normalizeColor(colors[Math.floor(Math.random() * colors.length)]);

    pushGpuParticle({
      x: barX + Math.random() * barWidth,
      y: barY + Math.random() * 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      drag: 0.93 + Math.random() * 0.03,
      size: 14 + Math.random() * 15,
      color,
      alpha: 0.96,
      fadePower: 1.18,
      gravity,
      lifeMs: (640 + Math.random() * 540) * lifeMultiplier
    });
  }

  trimGpuParticles();
  return true;
}

export function spawnGpuProgressCollectionLaserBurst(
  barX: number,
  barY: number,
  barWidth: number,
  barHeight: number,
  color: ColorInput,
  targetColor?: ColorInput
) {
  if (!WEBGL_EFFECTS.ready && !WEBGL_EFFECTS.mainGl) {
    return false;
  }

  if (!WEBGL_EFFECTS.laserRectProgram && !WEBGL_EFFECTS.mainLaserRectProgram) {
    return false;
  }

  const centerX = Number(barX) + Number(barWidth) / 2;
  const centerY = Number(barY) + Number(barHeight) / 2;
  const burstHeight = Math.max(1, Number(barHeight) || 1);
  const burstWidth = Math.max(1, Number(barWidth) || 1);

  pushGpuLaserRect({
    originX: centerX,
    originY: centerY,
    angle: -Math.PI / 2,
    baseLength: burstHeight,
    growLength: burstHeight * 0.48,
    baseThickness: burstWidth,
    growThickness: burstWidth * 2.84,
    travel: 1,
    color,
    targetColor: targetColor || color,
    alpha: 0.47,
    growDurationScale: 1.8,
    lifeMs: 899
  });

  trimGpuLaserBursts();
  return true;
}

function renderLiquidBubbles(gl: WebGLRenderingContext, canvasWidth: number, canvasHeight: number) {
  const bubbles = WEBGL_EFFECTS.liquidBubbles;
  const clipRect = WEBGL_EFFECTS.liquidClipRect;
  const bubbleUniforms = WEBGL_EFFECTS.bubbleUniforms;

  if (
    !WEBGL_EFFECTS.bubbleProgram ||
    !bubbleUniforms?.resolution ||
    !clipRect ||
    bubbles.length === 0 ||
    clipRect.width <= 0 ||
    clipRect.height <= 0
  ) {
    return;
  }

  const drawCount = Math.min(bubbles.length, MAX_GPU_LIQUID_BUBBLES);
  const data = WEBGL_EFFECTS.bubbleData;
  let offset = 0;

  for (let i = 0; i < drawCount; i += 1) {
    const bubble = bubbles[i];
    const bottomFade = Math.min(Math.max((clipRect.y + clipRect.height - bubble.y + bubble.radius * 2) / Math.max(1, bubble.radius * 8), 0), 1);
    const topFade = Math.min(Math.max((bubble.y - clipRect.y) / Math.max(1, bubble.radius * 8), 0), 1);
    const shimmer = 0.9 + Math.sin((bubble.ageMs / 1000) * 2.1 + bubble.phase) * 0.08;
    const alpha = bubble.alpha * Math.min(bottomFade, topFade) * shimmer;

    data[offset] = bubble.x;
    data[offset + 1] = bubble.y;
    data[offset + 2] = bubble.radius * 3.2;
    data[offset + 3] = alpha;
    offset += BUBBLE_FLOATS;
  }

  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(
    Math.floor(clipRect.x),
    Math.floor(canvasHeight - clipRect.y - clipRect.height),
    Math.ceil(clipRect.width),
    Math.ceil(clipRect.height)
  );
  gl.useProgram(WEBGL_EFFECTS.bubbleProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, WEBGL_EFFECTS.bubbleBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, drawCount * BUBBLE_FLOATS), gl.DYNAMIC_DRAW);

  bindBubbleAttributes(gl);
  gl.uniform2f(
    bubbleUniforms.resolution,
    canvasWidth,
    canvasHeight
  );
  gl.drawArrays(gl.POINTS, 0, drawCount);
  gl.disable(gl.SCISSOR_TEST);
}

function renderProgressBarGlow(gl: WebGLRenderingContext, canvasWidth: number, canvasHeight: number) {
  const glow = WEBGL_EFFECTS.progressBarGlow;
  const glowUniforms = WEBGL_EFFECTS.glowUniforms;
  const glowAttributes = WEBGL_EFFECTS.glowAttributes;

  if (
    !WEBGL_EFFECTS.glowProgram ||
    !glowUniforms?.resolution ||
    !glowUniforms.rect ||
    !glowUniforms.color ||
    !glowUniforms.intensity ||
    !glowUniforms.radius ||
    glowAttributes?.position == null ||
    !glow
  ) {
    return;
  }

  if (
    glow.width <= 0 ||
    glow.height <= 0 ||
    glow.intensity <= 0
  ) {
    return;
  }

  const radius = glow.radius;
  const drawPadding = radius * 2.1 + 2;
  const x1 = glow.x - drawPadding;
  const y1 = glow.y - drawPadding;
  const x2 = glow.x + glow.width + drawPadding;
  const y2 = glow.y + glow.height + drawPadding;
  const data = WEBGL_EFFECTS.glowData;

  data[0] = x1;
  data[1] = y1;
  data[2] = x2;
  data[3] = y1;
  data[4] = x1;
  data[5] = y2;
  data[6] = x1;
  data[7] = y2;
  data[8] = x2;
  data[9] = y1;
  data[10] = x2;
  data[11] = y2;

  gl.useProgram(WEBGL_EFFECTS.glowProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, WEBGL_EFFECTS.glowBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

  gl.enableVertexAttribArray(glowAttributes.position);
  gl.vertexAttribPointer(glowAttributes.position, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(
    glowUniforms.resolution,
    canvasWidth,
    canvasHeight
  );
  gl.uniform4f(glowUniforms.rect, glow.x, glow.y, glow.width, glow.height);
  gl.uniform3f(glowUniforms.color, glow.color[0], glow.color[1], glow.color[2]);
  gl.uniform1f(glowUniforms.intensity, glow.intensity);
  gl.uniform1f(glowUniforms.radius, radius);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function updateGpuLaserBursts(deltaTime: number) {
  const laserBursts = WEBGL_EFFECTS.laserBursts;
  if (laserBursts.length === 0) return;

  let writeIndex = 0;

  for (let i = 0; i < laserBursts.length; i += 1) {
    const rect = laserBursts[i];
    rect.elapsedMs += deltaTime;

    if (rect.elapsedMs >= rect.delayMs + rect.lifeMs) {
      continue;
    }

    laserBursts[writeIndex] = rect;
    writeIndex += 1;
  }

  laserBursts.length = writeIndex;
}

function renderLaserBursts(gl: WebGLRenderingContext, canvasWidth: number, canvasHeight: number, useMain = false) {
  const laserBursts = WEBGL_EFFECTS.laserBursts;
  const program = useMain ? WEBGL_EFFECTS.mainLaserRectProgram : WEBGL_EFFECTS.laserRectProgram;
  const buffer = useMain ? WEBGL_EFFECTS.mainLaserRectBuffer : WEBGL_EFFECTS.laserRectBuffer;
  const uniforms = useMain ? WEBGL_EFFECTS.mainLaserRectUniforms : WEBGL_EFFECTS.laserRectUniforms;
  const attributes = useMain ? WEBGL_EFFECTS.mainLaserRectAttributes : WEBGL_EFFECTS.laserRectAttributes;

  if (
    !program ||
    !uniforms?.resolution ||
    !buffer ||
    !attributes ||
    laserBursts.length === 0
  ) {
    return;
  }

  const data = WEBGL_EFFECTS.laserRectData;
  let offset = 0;
  let vertexCount = 0;

  for (let i = 0; i < laserBursts.length; i += 1) {
    const rect = laserBursts[i];
    const activeMs = rect.elapsedMs - rect.delayMs;
    if (activeMs <= 0) continue;

    const progress = Math.min(Math.max(activeMs / rect.lifeMs, 0), 1);
    if (progress >= 1) continue;

    const growProgress = Math.min(progress / rect.growDurationScale, 1);
    const grow = 1 - Math.pow(1 - growProgress, 3);
    const attack = Math.min(progress / 0.08, 1);
    const alpha = rect.alpha * attack * Math.pow(1 - progress, 1.48);

    if (alpha <= 0.004) continue;

    const length = rect.baseLength + rect.growLength * grow;
    const thickness = rect.baseThickness + rect.growThickness * grow;
    const directionX = Math.cos(rect.angle);
    const directionY = Math.sin(rect.angle);
    const halfLength = Math.max(0.5, length * 0.5);
    const halfThickness = Math.max(0.5, thickness * 0.5);
    const axisX = directionX * halfLength;
    const axisY = directionY * halfLength;
    const perpX = -directionY * halfThickness;
    const perpY = directionX * halfThickness;
    const centerX = rect.originX + rect.travelX * grow;
    const centerY = rect.originY + rect.travelY * grow;

    for (let vertex = 0; vertex < LASER_RECT_VERTICES; vertex += 1) {
      if (vertexCount >= MAX_GPU_LASER_RECTS * LASER_RECT_VERTICES) {
        break;
      }

      const r = rect.color[0] + (rect.targetColor[0] - rect.color[0]) * grow;
      const g = rect.color[1] + (rect.targetColor[1] - rect.color[1]) * grow;
      const b = rect.color[2] + (rect.targetColor[2] - rect.color[2]) * grow;

      const localOffset = vertex * 2;
      data[offset] = centerX;
      data[offset + 1] = centerY;
      data[offset + 2] = axisX;
      data[offset + 3] = axisY;
      data[offset + 4] = perpX;
      data[offset + 5] = perpY;
      data[offset + 6] = LASER_RECT_LOCAL_POINTS[localOffset];
      data[offset + 7] = LASER_RECT_LOCAL_POINTS[localOffset + 1];
      data[offset + 8] = r;
      data[offset + 9] = g;
      data[offset + 10] = b;
      data[offset + 11] = alpha;
      offset += LASER_RECT_FLOATS;
      vertexCount += 1;
    }

    if (vertexCount >= MAX_GPU_LASER_RECTS * LASER_RECT_VERTICES) {
      break;
    }
  }

  if (vertexCount === 0) return;

  if (useMain) {
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, offset), gl.DYNAMIC_DRAW);

  bindLaserRectAttributes(gl, attributes);
  gl.uniform2f(
    uniforms.resolution,
    canvasWidth,
    canvasHeight
  );
  gl.drawArrays(gl.TRIANGLES, 0, vertexCount);

  if (useMain) {
    // Restore default blend mode for main renderer
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
}

function spawnGpuLiquidBubble(
  barX: number,
  barY: number,
  barWidth: number,
  barHeight: number,
  fillHeight: number,
  fillRatio: number
) {
  const radius = BUBBLE_SIZE - 0.31 + Math.random() * (0.62 + fillRatio * 0.32);
  const padding = 3 + radius;
  const availableWidth = Math.max(0, barWidth - padding * 2);
  const bottomY = barY + barHeight;

  WEBGL_EFFECTS.liquidBubbles.push({
    x: barX + padding + Math.random() * availableWidth,
    y: bottomY - Math.random() * Math.min(12, fillHeight * 0.22) + radius,
    radius,
    speed: 45 + Math.random() * 33,
    phase: Math.random() * TWO_PI,
    alpha: 0.82 + Math.random() * 0.16,
    ageMs: Math.random() * 600
  });
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  if (!vertexShader || !fragmentShader) {
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    return null;
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('WebGL effects program failed to link:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('WebGL effects shader failed to compile:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function bindParticleAttributes(gl: WebGLRenderingContext, attributes: AttributeLocations<"position" | "size" | "color"> | null) {
  const stride = PARTICLE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  if (!attributes) return;

  gl.enableVertexAttribArray(attributes.position);
  gl.vertexAttribPointer(attributes.position, 2, gl.FLOAT, false, stride, 0);

  gl.enableVertexAttribArray(attributes.size);
  gl.vertexAttribPointer(attributes.size, 1, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);

  gl.enableVertexAttribArray(attributes.color);
  gl.vertexAttribPointer(attributes.color, 4, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
}

function bindBubbleAttributes(gl: WebGLRenderingContext) {
  const stride = BUBBLE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  const attributes = WEBGL_EFFECTS.bubbleAttributes;
  if (!attributes) return;

  gl.enableVertexAttribArray(attributes.position);
  gl.vertexAttribPointer(attributes.position, 2, gl.FLOAT, false, stride, 0);

  gl.enableVertexAttribArray(attributes.size);
  gl.vertexAttribPointer(attributes.size, 1, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);

  gl.enableVertexAttribArray(attributes.alpha);
  gl.vertexAttribPointer(attributes.alpha, 1, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
}

function bindLaserRectAttributes(gl: WebGLRenderingContext, attributes: AttributeLocations<"center" | "axis" | "perp" | "local" | "color"> | null) {
  const stride = LASER_RECT_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  if (!attributes) return;

  gl.enableVertexAttribArray(attributes.center);
  gl.vertexAttribPointer(attributes.center, 2, gl.FLOAT, false, stride, 0);

  gl.enableVertexAttribArray(attributes.axis);
  gl.vertexAttribPointer(attributes.axis, 2, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);

  gl.enableVertexAttribArray(attributes.perp);
  gl.vertexAttribPointer(attributes.perp, 2, gl.FLOAT, false, stride, 4 * Float32Array.BYTES_PER_ELEMENT);

  gl.enableVertexAttribArray(attributes.local);
  gl.vertexAttribPointer(attributes.local, 2, gl.FLOAT, false, stride, 6 * Float32Array.BYTES_PER_ELEMENT);

  gl.enableVertexAttribArray(attributes.color);
  gl.vertexAttribPointer(attributes.color, 4, gl.FLOAT, false, stride, 8 * Float32Array.BYTES_PER_ELEMENT);
}

function pushGpuParticle(options: ParticleOptions) {
  const color = normalizeColor(options.color);

  WEBGL_EFFECTS.particles.push({
    x: options.x,
    y: options.y,
    vx: options.vx,
    vy: options.vy,
    drag: options.drag,
    size: options.size,
    r: color[0],
    g: color[1],
    b: color[2],
    alpha: options.alpha ?? 1,
    fadePower: options.fadePower ?? 1,
    gravity: Math.max(0, Number(options.gravity) || 0),
    elapsedMs: 0,
    lifeMs: options.lifeMs
  });
}

function pushGpuLaserRect(options: LaserRectOptions) {
  const color = normalizeColor(options.color);
  const targetColor = normalizeColor(options.targetColor || options.color);

  WEBGL_EFFECTS.laserBursts.push({
    originX: Number(options.originX) || 0,
    originY: Number(options.originY) || 0,
    angle: Number(options.angle) || 0,
    baseLength: Math.max(0.5, Number(options.baseLength) || 0.5),
    growLength: Math.max(0, Number(options.growLength) || 0),
    baseThickness: Math.max(0.5, Number(options.baseThickness) || 0.5),
    growThickness: Math.max(0, Number(options.growThickness) || 0),
    travelX: Number.isFinite(Number(options.travelX))
      ? Number(options.travelX)
      : Math.cos(Number(options.angle) || 0) * (Number(options.travel) || 0),
    travelY: Number.isFinite(Number(options.travelY))
      ? Number(options.travelY)
      : Math.sin(Number(options.angle) || 0) * (Number(options.travel) || 0),
    color,
    targetColor,
    alpha: Math.min(Math.max(Number(options.alpha) || 0, 0), 1.4),
    delayMs: Math.max(0, Number(options.delayMs) || 0),
    elapsedMs: 0,
    growDurationScale: Math.max(0.1, Number(options.growDurationScale) || 1),
    lifeMs: Math.max(16, Number(options.lifeMs) || 280)
  });
}

function trimGpuParticles() {
  const particles = WEBGL_EFFECTS.particles;
  if (particles.length <= MAX_GPU_PARTICLES) return;

  particles.splice(0, particles.length - MAX_GPU_PARTICLES);
}

function trimGpuLaserBursts() {
  const laserBursts = WEBGL_EFFECTS.laserBursts;
  if (laserBursts.length <= MAX_GPU_LASER_RECTS) return;

  laserBursts.splice(0, laserBursts.length - MAX_GPU_LASER_RECTS);
}

function normalizeColor(color: any): Rgb {
  if (Array.isArray(color)) {
    const r = Number(color[0]) || 0;
    const g = Number(color[1]) || 0;
    const b = Number(color[2]) || 0;

    // If any component is > 1.0, assume it's 0-255 range and normalize it.
    // Otherwise, assume it's already in the 0.0-1.0 range.
    const isHighRange = r > 1.0 || g > 1.0 || b > 1.0;
    const factor = isHighRange ? 255 : 1;

    return [
      clampColorChannel(r / factor),
      clampColorChannel(g / factor),
      clampColorChannel(b / factor)
    ];
  }

  if (typeof color === 'string' && color.startsWith('#')) {
    const hex = color.slice(1);
    const expanded = hex.length === 3
      ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
      : hex;

    const value = Number.parseInt(expanded, 16);
    if (Number.isFinite(value)) {
      return [
        ((value >> 16) & 255) / 255,
        ((value >> 8) & 255) / 255,
        (value & 255) / 255
      ];
    }
  }

  return [1, 1, 1];
}

function clampColorChannel(value: number) {
  return Math.min(Math.max(Number(value) || 0, 0), 1);
}
