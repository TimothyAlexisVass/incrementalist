import { OrthographicCamera, Scene, WebGLRenderer as ThreeWebGLRenderer } from "three";
import { Text } from "troika-three-text";

export type RGBA = readonly [number, number, number, number];

export interface WebGLRendererOptions {
  canvas: HTMLCanvasElement;
  gl?: WebGLRenderingContext;
}

export interface DrawRectOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  color: RGBA;
  alpha?: number;
}

export interface DrawTextOptions {
  text: string;
  x: number;
  y: number;
  font?: string;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  alpha?: number;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  scale?: number;
}

export type TextReadinessOptions = Omit<DrawTextOptions, "x" | "y">;

export interface MeasureTextOptions {
  text: string;
  font?: string;
}

export interface DrawImageOptions {
  image: TexImageSource;
  x: number;
  y: number;
  width: number;
  height: number;
  alpha?: number;
}

interface ParsedFontSpec {
  fontFamily: string;
  fontSizePx: number;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  troikaFontUrl: string;
}

interface TextDrawStyle {
  fontSpec: ParsedFontSpec;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
}

interface CachedTextMesh {
  mesh: Text;
  ready: boolean;
  frameLastUsed: number;
}

interface CachedTextMeasurement {
  mesh: Text;
  width: number;
  ready: boolean;
  frameLastUsed: number;
}

const DEFAULT_FONT = "bold 16px Inter";
const DEFAULT_TEXT_COLOR = "#ffffff";
const INTER_REGULAR_FONT_URL = "/fonts/Inter-Regular.woff";
const INTER_BOLD_FONT_URL = "/fonts/Inter-Bold.woff";
const MAX_TEXT_CACHE_SIZE = 384;
const TEXT_CACHE_FRAME_TTL = 900;

const COLOR_VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
uniform vec2 u_resolution;

void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 clipSpace = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
}
`;

const COLOR_FRAGMENT_SHADER_SOURCE = `
precision mediump float;
uniform vec4 u_color;

void main() {
  gl_FragColor = u_color;
}
`;

const SHAPE_VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_texcoord;
uniform vec2 u_resolution;
varying vec2 v_texcoord;

void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 clipSpace = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  v_texcoord = a_texcoord;
}
`;

const SHAPE_FRAGMENT_SHADER_SOURCE = `
precision mediump float;
uniform vec4 u_color;
uniform float u_innerRadius;
uniform float u_thickness;
uniform float u_softness;
uniform float u_startAngle;
uniform float u_endAngle;
varying vec2 v_texcoord;

#define PI 3.14159265359

void main() {
  vec2 uv = v_texcoord - 0.5;
  float dist = length(uv) * 2.0;
  float alpha = 0.0;
  
  if (u_thickness > 0.0) {
    // Ring logic: glow centered at u_innerRadius with width u_thickness
    float halfThickness = u_thickness * 0.5;
    float d = abs(dist - u_innerRadius) - halfThickness;
    alpha = smoothstep(u_softness, 0.0, d);
  } else {
    // Circle logic: glow centered at 0, edge at u_innerRadius
    float d = dist - u_innerRadius;
    alpha = smoothstep(u_softness, 0.0, d);
  }
  
  // Angle clipping for Arcs
  // We use a small epsilon to avoid float equality issues for "no clipping"
  if (abs(u_startAngle - u_endAngle) > 0.001 && abs(u_startAngle - u_endAngle) < 6.28) {
    float angle = atan(uv.y, uv.x);
    if (angle < 0.0) angle += 2.0 * PI;
    
    float s = mod(u_startAngle, 2.0 * PI);
    if (s < 0.0) s += 2.0 * PI;
    float e = mod(u_endAngle, 2.0 * PI);
    if (e < 0.0) e += 2.0 * PI;
    
    bool inRange = false;
    if (s <= e) {
      inRange = (angle >= s && angle <= e);
    } else {
      inRange = (angle >= s || angle <= e);
    }
    
    if (!inRange) {
      alpha = 0.0;
    }
  }
  
  float finalAlpha = u_color.a * alpha;
  gl_FragColor = vec4(u_color.rgb * finalAlpha, finalAlpha);
}
`;

const LIQUID_VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_texcoord;
uniform vec2 u_resolution;
varying vec2 v_texcoord;

void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 clipSpace = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  v_texcoord = a_texcoord;
}
`;

const LIQUID_FRAGMENT_SHADER_SOURCE = `
precision mediump float;
uniform float u_time;
uniform float u_progress;
uniform vec3 u_colorStart;
uniform vec3 u_colorMid;
uniform vec3 u_colorEnd;
uniform float u_barHeight;
uniform float u_alpha;
varying vec2 v_texcoord;

void main() {
  // Wave height logic ported from JS
  float maxWaveHeight = 2.2; 
  float waveHeightUV = min(maxWaveHeight / u_barHeight, min(u_progress * 0.08, (1.0 - u_progress) * 0.55));
  
  float xRatio = v_texcoord.x;
  float primaryWave = sin(xRatio * 6.28318 * 0.7 + u_time * 0.0032);
  float secondaryWave = sin(xRatio * 6.28318 * 1.35 - u_time * 0.0024);
  float surfaceY = (1.0 - u_progress) + primaryWave * waveHeightUV + secondaryWave * waveHeightUV * 0.22;

  if (v_texcoord.y < surfaceY) {
    discard;
  }

  vec3 color;
  // Gradient logic ported from JS: 0=End (top), 0.5=Mid, 1.0=Start (bottom)
  if (v_texcoord.y < 0.5) {
    float t = v_texcoord.y * 2.0;
    color = mix(u_colorEnd, u_colorMid, t);
  } else {
    float t = (v_texcoord.y - 0.5) * 2.0;
    color = mix(u_colorMid, u_colorStart, t);
  }

  // Surface highlight logic
  float distToSurface = abs(v_texcoord.y - surfaceY);
  float highlight = smoothstep(1.5 / u_barHeight, 0.0, distToSurface);
  float surfaceGlow = clamp(0.22 + u_progress * 0.34, 0.0, 0.5);
  
  // Mix in highlight
  color = mix(color, vec3(1.0), highlight * surfaceGlow);

  gl_FragColor = vec4(color * u_alpha, u_alpha);
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
uniform float u_innerAlpha;
uniform float u_outerAlpha;
varying vec2 v_position;

void main() {
  vec2 rectMin = u_rect.xy;
  vec2 rectMax = u_rect.xy + u_rect.zw;
  vec2 outsideDelta = max(max(rectMin - v_position, v_position - rectMax), vec2(0.0));
  float outsideDistance = length(outsideDelta);
  
  // Outer glow with multiple layers for softness
  float outsideGlow = (1.0 - smoothstep(0.0, u_radius * 1.55, outsideDistance)) * step(0.0001, outsideDistance);
  float outsideSoft = (1.0 - smoothstep(0.0, u_radius * 2.2, outsideDistance)) * step(0.0001, outsideDistance);
  float finalOuter = (outsideGlow * 0.8 + outsideSoft * 0.2) * u_outerAlpha;
  
  // Inner glow (inset shadow)
  float insideEdge = min(
    min(v_position.x - rectMin.x, rectMax.x - v_position.x),
    min(v_position.y - rectMin.y, rectMax.y - v_position.y)
  );
  float insideGlow = (1.0 - smoothstep(0.0, u_radius * 0.6, insideEdge)) * step(0.0, insideEdge);
  float insideSoft = (1.0 - smoothstep(0.0, u_radius * 1.2, insideEdge)) * step(0.0, insideEdge);
  float finalInner = (insideGlow * 0.7 + insideSoft * 0.3) * u_innerAlpha;
  
  float alpha = (finalOuter + finalInner) * u_intensity;
  gl_FragColor = vec4(u_color * alpha, alpha);
}
`;

const TEXT_VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_texcoord;
uniform vec2 u_resolution;
varying vec2 v_texcoord;

void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 clipSpace = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  v_texcoord = a_texcoord;
}
`;

const TEXT_FRAGMENT_SHADER_SOURCE = `
precision mediump float;
uniform sampler2D u_texture;
uniform float u_alpha;
varying vec2 v_texcoord;

void main() {
  vec4 sampled = texture2D(u_texture, v_texcoord);
  float alpha = sampled.a * u_alpha;
  gl_FragColor = vec4(sampled.rgb * alpha, alpha);
}
`;

export class WebGLRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGLRenderingContext;

  private readonly colorProgram: WebGLProgram;
  private readonly colorPositionLocation: number;
  private readonly colorResolutionLocation: WebGLUniformLocation;
  private readonly colorUniformLocation: WebGLUniformLocation;
  private readonly colorBuffer: WebGLBuffer;

  private readonly textProgram: WebGLProgram;
  private readonly textPositionLocation: number;
  private readonly textTexcoordLocation: number;
  private readonly textResolutionLocation: WebGLUniformLocation;
  private readonly textAlphaLocation: WebGLUniformLocation;
  private readonly textTextureLocation: WebGLUniformLocation;
  private readonly textPositionBuffer: WebGLBuffer;
  private readonly textTexcoordBuffer: WebGLBuffer;

  private readonly shapeProgram: WebGLProgram;
  private readonly shapePositionLocation: number;
  private readonly shapeTexcoordLocation: number;
  private readonly shapeResolutionLocation: WebGLUniformLocation;
  private readonly shapeColorLocation: WebGLUniformLocation;
  private readonly shapeInnerRadiusLocation: WebGLUniformLocation;
  private readonly shapeThicknessLocation: WebGLUniformLocation;
  private readonly shapeSoftnessLocation: WebGLUniformLocation;
  private readonly shapeStartAngleLocation: WebGLUniformLocation;
  private readonly shapeEndAngleLocation: WebGLUniformLocation;
  private readonly shapePositionBuffer: WebGLBuffer;
  private readonly shapeTexcoordBuffer: WebGLBuffer;

  private readonly liquidProgram: WebGLProgram;
  private readonly liquidPositionLocation: number;
  private readonly liquidTexcoordLocation: number;
  private readonly liquidResolutionLocation: WebGLUniformLocation;
  private readonly liquidTimeLocation: WebGLUniformLocation;
  private readonly liquidProgressLocation: WebGLUniformLocation;
  private readonly liquidColorStartLocation: WebGLUniformLocation;
  private readonly liquidColorMidLocation: WebGLUniformLocation;
  private readonly liquidColorEndLocation: WebGLUniformLocation;
  private readonly liquidBarHeightLocation: WebGLUniformLocation;
  private readonly liquidAlphaLocation: WebGLUniformLocation;
  private readonly liquidPositionBuffer: WebGLBuffer;
  private readonly liquidTexcoordBuffer: WebGLBuffer;

  private readonly glowProgram: WebGLProgram;
  private readonly glowPositionLocation: number;
  private readonly glowResolutionLocation: WebGLUniformLocation;
  private readonly glowRectLocation: WebGLUniformLocation;
  private readonly glowColorLocation: WebGLUniformLocation;
  private readonly glowIntensityLocation: WebGLUniformLocation;
  private readonly glowRadiusLocation: WebGLUniformLocation;
  private readonly glowInnerAlphaLocation: WebGLUniformLocation;
  private readonly glowOuterAlphaLocation: WebGLUniformLocation;
  private readonly glowBuffer: WebGLBuffer;

  private readonly threeRenderer: ThreeWebGLRenderer;
  private readonly textScene: Scene;
  private readonly textCamera: OrthographicCamera;
  private readonly textCache = new Map<string, CachedTextMesh>();
  private readonly textMeasureCache = new Map<string, CachedTextMeasurement>();
  private readonly imageCache = new WeakMap<object, WebGLTexture>();
  private frameCounter = 0;
  private _globalAlpha = 1.0;

  constructor(options: WebGLRendererOptions) {
    this.canvas = options.canvas;
    const gl =
      options.gl ??
      this.canvas.getContext("webgl", {
        alpha: true,
        antialias: false,
        depth: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        stencil: false
      });

    if (!gl) {
      throw new Error("WebGLRenderer requires a WebGL context");
    }

    this.gl = gl;

    this.colorProgram = mustCreateProgram(gl, COLOR_VERTEX_SHADER_SOURCE, COLOR_FRAGMENT_SHADER_SOURCE);
    this.colorPositionLocation = gl.getAttribLocation(this.colorProgram, "a_position");
    this.colorResolutionLocation = mustGetUniform(gl, this.colorProgram, "u_resolution");
    this.colorUniformLocation = mustGetUniform(gl, this.colorProgram, "u_color");
    this.colorBuffer = mustCreateBuffer(gl);

    this.textProgram = mustCreateProgram(gl, TEXT_VERTEX_SHADER_SOURCE, TEXT_FRAGMENT_SHADER_SOURCE);
    this.textPositionLocation = gl.getAttribLocation(this.textProgram, "a_position");
    this.textTexcoordLocation = gl.getAttribLocation(this.textProgram, "a_texcoord");
    this.textResolutionLocation = mustGetUniform(gl, this.textProgram, "u_resolution");
    this.textAlphaLocation = mustGetUniform(gl, this.textProgram, "u_alpha");
    this.textTextureLocation = mustGetUniform(gl, this.textProgram, "u_texture");
    this.textPositionBuffer = mustCreateBuffer(gl);
    this.textTexcoordBuffer = mustCreateBuffer(gl);

    this.shapeProgram = mustCreateProgram(gl, SHAPE_VERTEX_SHADER_SOURCE, SHAPE_FRAGMENT_SHADER_SOURCE);
    this.shapePositionLocation = gl.getAttribLocation(this.shapeProgram, "a_position");
    this.shapeTexcoordLocation = gl.getAttribLocation(this.shapeProgram, "a_texcoord");
    this.shapeResolutionLocation = mustGetUniform(gl, this.shapeProgram, "u_resolution");
    this.shapeColorLocation = mustGetUniform(gl, this.shapeProgram, "u_color");
    this.shapeInnerRadiusLocation = mustGetUniform(gl, this.shapeProgram, "u_innerRadius");
    this.shapeThicknessLocation = mustGetUniform(gl, this.shapeProgram, "u_thickness");
    this.shapeSoftnessLocation = mustGetUniform(gl, this.shapeProgram, "u_softness");
    this.shapeStartAngleLocation = mustGetUniform(gl, this.shapeProgram, "u_startAngle");
    this.shapeEndAngleLocation = mustGetUniform(gl, this.shapeProgram, "u_endAngle");
    this.shapePositionBuffer = mustCreateBuffer(gl);
    this.shapeTexcoordBuffer = mustCreateBuffer(gl);

    this.liquidProgram = mustCreateProgram(gl, LIQUID_VERTEX_SHADER_SOURCE, LIQUID_FRAGMENT_SHADER_SOURCE);
    this.liquidPositionLocation = gl.getAttribLocation(this.liquidProgram, "a_position");
    this.liquidTexcoordLocation = gl.getAttribLocation(this.liquidProgram, "a_texcoord");
    this.liquidResolutionLocation = mustGetUniform(gl, this.liquidProgram, "u_resolution");
    this.liquidTimeLocation = mustGetUniform(gl, this.liquidProgram, "u_time");
    this.liquidProgressLocation = mustGetUniform(gl, this.liquidProgram, "u_progress");
    this.liquidColorStartLocation = mustGetUniform(gl, this.liquidProgram, "u_colorStart");
    this.liquidColorMidLocation = mustGetUniform(gl, this.liquidProgram, "u_colorMid");
    this.liquidColorEndLocation = mustGetUniform(gl, this.liquidProgram, "u_colorEnd");
    this.liquidBarHeightLocation = mustGetUniform(gl, this.liquidProgram, "u_barHeight");
    this.liquidAlphaLocation = mustGetUniform(gl, this.liquidProgram, "u_alpha");
    this.liquidPositionBuffer = mustCreateBuffer(gl);
    this.liquidTexcoordBuffer = mustCreateBuffer(gl);

    this.glowProgram = mustCreateProgram(gl, GLOW_VERTEX_SHADER_SOURCE, GLOW_FRAGMENT_SHADER_SOURCE);
    this.glowPositionLocation = gl.getAttribLocation(this.glowProgram, "a_position");
    this.glowResolutionLocation = mustGetUniform(gl, this.glowProgram, "u_resolution");
    this.glowRectLocation = mustGetUniform(gl, this.glowProgram, "u_rect");
    this.glowColorLocation = mustGetUniform(gl, this.glowProgram, "u_color");
    this.glowIntensityLocation = mustGetUniform(gl, this.glowProgram, "u_intensity");
    this.glowRadiusLocation = mustGetUniform(gl, this.glowProgram, "u_radius");
    this.glowInnerAlphaLocation = mustGetUniform(gl, this.glowProgram, "u_innerAlpha");
    this.glowOuterAlphaLocation = mustGetUniform(gl, this.glowProgram, "u_outerAlpha");
    this.glowBuffer = mustCreateBuffer(gl);

    this.threeRenderer = new ThreeWebGLRenderer({
      canvas: this.canvas,
      context: gl,
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false
    });
    this.threeRenderer.autoClear = false;
    this.threeRenderer.setPixelRatio(1);
    this.textScene = new Scene();
    this.textCamera = new OrthographicCamera(0, this.canvas.width, this.canvas.height, 0, -1, 1);
    this.textCamera.position.z = 1;

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    this.setBlendMode("normal");
  }

  public setBlendMode(mode: "normal" | "additive") {
    const gl = this.gl;
    if (mode === "additive") {
      gl.blendFunc(gl.ONE, gl.ONE);
    } else {
      // Use ONE for src since we are premultiplying in the shader
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
  }

  public setGlobalAlpha(alpha: number) {
    this._globalAlpha = clamp01(alpha);
  }

  public getGlobalAlpha() {
    return this._globalAlpha;
  }

  resize(width: number, height: number) {
    const nextWidth = Math.max(1, Math.floor(Number(width) || this.canvas.width || 1));
    const nextHeight = Math.max(1, Math.floor(Number(height) || this.canvas.height || 1));

    if (this.canvas.width !== nextWidth) this.canvas.width = nextWidth;
    if (this.canvas.height !== nextHeight) this.canvas.height = nextHeight;

    this.gl.viewport(0, 0, nextWidth, nextHeight);
    this.threeRenderer.setSize(nextWidth, nextHeight, false);
    this.textCamera.left = 0;
    this.textCamera.right = nextWidth;
    this.textCamera.top = nextHeight;
    this.textCamera.bottom = 0;
    this.textCamera.updateProjectionMatrix();
  }

  beginFrame(clearColor: RGBA = [0, 0, 0, 0]) {
    this.frameCounter += 1;
    this.evictUnusedTextCacheEntries();
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  drawRect(options: DrawRectOptions) {
    const gl = this.gl;
    const { x, y, width, height, color } = options;

    if (width <= 0 || height <= 0) return;

    const x1 = x;
    const y1 = y;
    const x2 = x + width;
    const y2 = y + height;

    const vertices = new Float32Array([
      x1, y1,
      x2, y1,
      x1, y2,
      x1, y2,
      x2, y1,
      x2, y2
    ]);

    gl.useProgram(this.colorProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.colorPositionLocation);
    gl.vertexAttribPointer(this.colorPositionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(this.colorResolutionLocation, this.canvas.width, this.canvas.height);
    const alpha = clamp01(options.alpha ?? 1) * this._globalAlpha;
    gl.uniform4f(this.colorUniformLocation, color[0] * alpha, color[1] * alpha, color[2] * alpha, color[3] * alpha);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public drawLiquidRect(options: {
    x: number;
    y: number;
    width: number;
    height: number;
    progress: number;
    time: number;
    colorStart: [number, number, number];
    colorMid: [number, number, number];
    colorEnd: [number, number, number];
    alpha?: number;
  }) {
    const gl = this.gl;
    const { x, y, width, height, progress, time, colorStart, colorMid, colorEnd } = options;

    if (width <= 0 || height <= 0) return;

    const x2 = x + width;
    const y2 = y + height;
    const positions = new Float32Array([
      x, y,
      x2, y,
      x, y2,
      x, y2,
      x2, y,
      x2, y2
    ]);
    const texcoords = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1
    ]);

    gl.useProgram(this.liquidProgram);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.liquidPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.liquidPositionLocation);
    gl.vertexAttribPointer(this.liquidPositionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.liquidTexcoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.liquidTexcoordLocation);
    gl.vertexAttribPointer(this.liquidTexcoordLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(this.liquidResolutionLocation, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.liquidTimeLocation, time);
    gl.uniform1f(this.liquidProgressLocation, progress);
    gl.uniform3f(this.liquidColorStartLocation, colorStart[0] / 255, colorStart[1] / 255, colorStart[2] / 255);
    gl.uniform3f(this.liquidColorMidLocation, colorMid[0] / 255, colorMid[1] / 255, colorMid[2] / 255);
    gl.uniform3f(this.liquidColorEndLocation, colorEnd[0] / 255, colorEnd[1] / 255, colorEnd[2] / 255);
    gl.uniform1f(this.liquidBarHeightLocation, height);
    const alpha = (options.alpha ?? 1.0) * this._globalAlpha;
    gl.uniform1f(this.liquidAlphaLocation, alpha);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public drawGlowRect(options: {
    x: number;
    y: number;
    width: number;
    height: number;
    color: RGBA;
    radius: number;
    intensity: number;
    innerAlpha?: number;
    outerAlpha?: number;
    alpha?: number;
    blendMode?: "normal" | "additive";
  }) {
    const gl = this.gl;
    const { x, y, width, height, color, radius, intensity } = options;

    if (width <= 0 || height <= 0) return;

    // Expand vertex buffer slightly to ensure glow isn't clipped
    const padding = radius * 2.5;
    const x1 = x - padding;
    const y1 = y - padding;
    const x2 = x + width + padding;
    const y2 = y + height + padding;

    const vertices = new Float32Array([
      x1, y1,
      x2, y1,
      x1, y2,
      x1, y2,
      x2, y1,
      x2, y2
    ]);

    this.setBlendMode(options.blendMode || "normal");
    gl.useProgram(this.glowProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.glowPositionLocation);
    gl.vertexAttribPointer(this.glowPositionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(this.glowResolutionLocation, this.canvas.width, this.canvas.height);
    gl.uniform4f(this.glowRectLocation, x, y, width, height);
    gl.uniform3f(this.glowColorLocation, color[0] / 255, color[1] / 255, color[2] / 255);
    gl.uniform1f(this.glowIntensityLocation, intensity * (options.alpha ?? 1.0) * this._globalAlpha);
    gl.uniform1f(this.glowRadiusLocation, radius);
    gl.uniform1f(this.glowInnerAlphaLocation, options.innerAlpha ?? 0.0);
    gl.uniform1f(this.glowOuterAlphaLocation, options.outerAlpha ?? 0.0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.setBlendMode("normal");
  }

  drawCircle(x: number, y: number, radius: number, color: RGBA, softness = 0.1, blendMode: "normal" | "additive" = "normal") {
    // Add a small padding for anti-aliasing even if softness is 0
    const aaPadding = 1.5; 
    const glowSize = (radius * softness) + aaPadding;
    const drawRadius = radius + glowSize;

    this.setBlendMode(blendMode);
    this.drawShape({
      x: x - drawRadius,
      y: y - drawRadius,
      width: drawRadius * 2,
      height: drawRadius * 2,
      color,
      innerRadius: radius / drawRadius, // Edge of the solid part
      thickness: 0,
      softness: (glowSize / drawRadius), // Normalized softness
      startAngle: 0,
      endAngle: 0
    });
    this.setBlendMode("normal");
  }

  drawRing(x: number, y: number, radius: number, thickness: number, color: RGBA, softness = 0.1, blendMode: "normal" | "additive" = "normal") {
    // Add a small padding for anti-aliasing
    const aaPadding = 1.5;
    const glowSize = (thickness + radius * 0.25) * softness + aaPadding;
    const drawRadius = radius + thickness + glowSize;
    
    // For sub-pixel thickness, scale alpha to simulate anti-aliasing and ensure 0.2 != 0.002
    const alphaScale = Math.min(1.0, thickness);
    const finalColor: RGBA = [color[0], color[1], color[2], color[3] * alphaScale];

    this.setBlendMode(blendMode);
    this.drawShape({
      x: x - drawRadius,
      y: y - drawRadius,
      width: drawRadius * 2,
      height: drawRadius * 2,
      color: finalColor,
      innerRadius: radius / drawRadius, // Center of ring
      thickness: thickness / drawRadius, // Base thickness
      softness: (glowSize / drawRadius), // Normalized softness
      startAngle: 0,
      endAngle: 0
    });
    this.setBlendMode("normal");
  }

  drawArc(x: number, y: number, radius: number, thickness: number, startAngle: number, endAngle: number, color: RGBA, softness = 0.1, blendMode: "normal" | "additive" = "normal") {
    const aaPadding = 1.5;
    const glowSize = (thickness + radius * 0.25) * softness + aaPadding;
    const drawRadius = radius + thickness + glowSize;
    
    const alphaScale = Math.min(1.0, thickness);
    const finalColor: RGBA = [color[0], color[1], color[2], color[3] * alphaScale];

    this.setBlendMode(blendMode);
    this.drawShape({
      x: x - drawRadius,
      y: y - drawRadius,
      width: drawRadius * 2,
      height: drawRadius * 2,
      color: finalColor,
      innerRadius: radius / drawRadius,
      thickness: thickness / drawRadius,
      softness: (glowSize / drawRadius),
      startAngle,
      endAngle
    });
    this.setBlendMode("normal");
  }

  private drawShape(options: {
    x: number;
    y: number;
    width: number;
    height: number;
    color: RGBA;
    innerRadius: number;
    thickness: number;
    softness: number;
    startAngle: number;
    endAngle: number;
    alpha?: number;
  }) {
    const gl = this.gl;
    const { x, y, width, height, color, innerRadius, thickness, softness } = options;

    if (width <= 0 || height <= 0) return;

    const x2 = x + width;
    const y2 = y + height;
    const positions = new Float32Array([
      x, y,
      x2, y,
      x, y2,
      x, y2,
      x2, y,
      x2, y2
    ]);
    const texcoords = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1
    ]);

    gl.useProgram(this.shapeProgram);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.shapePositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.shapePositionLocation);
    gl.vertexAttribPointer(this.shapePositionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.shapeTexcoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.shapeTexcoordLocation);
    gl.vertexAttribPointer(this.shapeTexcoordLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(this.shapeResolutionLocation, this.canvas.width, this.canvas.height);
    const alpha = (options.alpha ?? 1.0) * this._globalAlpha;
    gl.uniform4f(this.shapeColorLocation, color[0], color[1], color[2], (color[3] ?? 1.0) * alpha);
    gl.uniform1f(this.shapeInnerRadiusLocation, innerRadius);
    gl.uniform1f(this.shapeThicknessLocation, thickness);
    gl.uniform1f(this.shapeSoftnessLocation, softness);
    gl.uniform1f(this.shapeStartAngleLocation, options.startAngle);
    gl.uniform1f(this.shapeEndAngleLocation, options.endAngle);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  drawImage(options: DrawImageOptions) {
    const gl = this.gl;
    const { image, x, y, width, height } = options;
    if (width <= 0 || height <= 0 || !isRenderableImage(image)) return;

    const texture = this.getOrCreateImageTexture(image);
    if (!texture) return;

    const x2 = x + width;
    const y2 = y + height;
    const positions = new Float32Array([
      x, y,
      x2, y,
      x, y2,
      x, y2,
      x2, y,
      x2, y2
    ]);
    const texcoords = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1
    ]);

    gl.useProgram(this.textProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.textPositionLocation);
    gl.vertexAttribPointer(this.textPositionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.textTexcoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.textTexcoordLocation);
    gl.vertexAttribPointer(this.textTexcoordLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(this.textResolutionLocation, this.canvas.width, this.canvas.height);
    const alpha = clamp01(options.alpha ?? 1) * this._globalAlpha;
    gl.uniform1f(this.textAlphaLocation, alpha);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.textTextureLocation, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  drawText(options: DrawTextOptions) {
    const text = options.text;
    if (!text) return;

    const alpha = clamp01(options.alpha ?? 1) * this._globalAlpha;
    if (alpha <= 0) return;

    const fontSpec = parseFontSpec(options.font || DEFAULT_FONT);
    const style: TextDrawStyle = {
      fontSpec,
      color: options.color || DEFAULT_TEXT_COLOR,
      strokeColor: options.strokeColor || "transparent",
      strokeWidth: Math.max(0, Number(options.strokeWidth) || 0),
      shadowColor: options.shadowColor || "transparent",
      shadowBlur: Math.max(0, Number(options.shadowBlur) || 0),
      shadowOffsetX: Number(options.shadowOffsetX) || 0,
      shadowOffsetY: Number(options.shadowOffsetY) || 0
    };
    const anchorX = mapTextAlign(options.align || "left");
    const anchorY = mapTextBaseline(options.baseline || "alphabetic");
    const cached = this.getOrCreateTroikaText(text, style, anchorX, anchorY, alpha);
    cached.frameLastUsed = this.frameCounter;
    const mesh = cached.mesh;
    mesh.position.set(options.x, this.canvas.height - options.y, 0);
    const s = options.scale ?? 1;
    mesh.scale.set(s, s, 1);
    this.textScene.add(mesh);
    this.threeRenderer.resetState();
    this.threeRenderer.render(this.textScene, this.textCamera);
    this.textScene.remove(mesh);
  }

  isTextReady(options: TextReadinessOptions) {
    const text = String(options.text ?? "");
    if (!text) return true;

    const alpha = clamp01(options.alpha ?? 1) * this._globalAlpha;
    if (alpha <= 0) return true;

    const fontSpec = parseFontSpec(options.font || DEFAULT_FONT);
    const style: TextDrawStyle = {
      fontSpec,
      color: options.color || DEFAULT_TEXT_COLOR,
      strokeColor: options.strokeColor || "transparent",
      strokeWidth: Math.max(0, Number(options.strokeWidth) || 0),
      shadowColor: options.shadowColor || "transparent",
      shadowBlur: Math.max(0, Number(options.shadowBlur) || 0),
      shadowOffsetX: Number(options.shadowOffsetX) || 0,
      shadowOffsetY: Number(options.shadowOffsetY) || 0
    };
    const anchorX = mapTextAlign(options.align || "left");
    const anchorY = mapTextBaseline(options.baseline || "alphabetic");
    const cached = this.getOrCreateTroikaText(text, style, anchorX, anchorY, alpha);
    cached.frameLastUsed = this.frameCounter;
    return cached.ready;
  }

  measureTextWidth(options: MeasureTextOptions) {
    const text = String(options.text ?? "");
    if (!text) return 0;

    const fontSpec = parseFontSpec(options.font || DEFAULT_FONT);
    const key = `${text}\u0000${fontSpec.fontFamily}\u0000${fontSpec.fontSizePx}\u0000${fontSpec.fontWeight}\u0000${fontSpec.fontStyle}`;
    const cached = this.textMeasureCache.get(key);
    if (cached) {
      cached.frameLastUsed = this.frameCounter;
      return cached.width;
    }

    const mesh = new Text();
    mesh.font = fontSpec.troikaFontUrl;
    mesh.fontSize = fontSpec.fontSizePx;
    mesh.fontWeight = fontSpec.fontWeight;
    mesh.fontStyle = fontSpec.fontStyle;
    mesh.text = text;
    const entry: CachedTextMeasurement = {
      mesh,
      width: estimateTextWidth(text, fontSpec.fontSizePx),
      ready: false,
      frameLastUsed: this.frameCounter
    };
    this.textMeasureCache.set(key, entry);
    this.enforceTextCacheSize();
    mesh.sync(() => {
      entry.width = readTextWidth(mesh, entry.width);
      entry.ready = true;
    });
    return entry.width;
  }

  clearTextCache() {
    for (const entry of this.textCache.values()) {
      entry.mesh.dispose();
    }
    this.textCache.clear();
    for (const entry of this.textMeasureCache.values()) {
      entry.mesh.dispose();
    }
    this.textMeasureCache.clear();
  }

  dispose() {
    const gl = this.gl;
    this.clearTextCache();
    gl.deleteBuffer(this.colorBuffer);
    gl.deleteBuffer(this.textPositionBuffer);
    gl.deleteBuffer(this.textTexcoordBuffer);
    gl.deleteBuffer(this.shapePositionBuffer);
    gl.deleteBuffer(this.shapeTexcoordBuffer);
    gl.deleteBuffer(this.liquidPositionBuffer);
    gl.deleteBuffer(this.liquidTexcoordBuffer);
    gl.deleteBuffer(this.glowBuffer);
    gl.deleteProgram(this.colorProgram);
    gl.deleteProgram(this.textProgram);
    gl.deleteProgram(this.shapeProgram);
    gl.deleteProgram(this.liquidProgram);
    gl.deleteProgram(this.glowProgram);
    this.threeRenderer.dispose();
  }

  private getOrCreateTroikaText(
    text: string,
    style: TextDrawStyle,
    anchorX: "left" | "center" | "right",
    anchorY: "top" | "top-baseline" | "middle" | "bottom" | "bottom-baseline",
    alpha: number
  ): CachedTextMesh {
    const key = [
      text,
      style.fontSpec.fontFamily,
      style.fontSpec.fontSizePx,
      style.fontSpec.fontWeight,
      style.fontSpec.fontStyle,
      anchorX,
      anchorY,
      style.color,
      style.strokeColor,
      style.strokeWidth,
      style.shadowColor,
      style.shadowBlur,
      style.shadowOffsetX,
      style.shadowOffsetY
    ].join("\u0000");
    const cached = this.textCache.get(key);
    if (cached) {
      this.configureTroikaText(cached.mesh, text, style, anchorX, anchorY, alpha);
      return cached;
    }

    const mesh = new Text();
    const entry: CachedTextMesh = {
      mesh,
      ready: false,
      frameLastUsed: this.frameCounter
    };
    this.configureTroikaText(mesh, text, style, anchorX, anchorY, alpha);
    mesh.sync(() => {
      entry.ready = true;
    });
    this.textCache.set(key, entry);
    this.enforceTextCacheSize();
    return entry;
  }

  private configureTroikaText(
    mesh: Text,
    text: string,
    style: TextDrawStyle,
    anchorX: "left" | "center" | "right",
    anchorY: "top" | "top-baseline" | "middle" | "bottom" | "bottom-baseline",
    alpha: number
  ) {
    const hasStroke = style.strokeColor !== "transparent" && style.strokeWidth > 0;
    const hasShadow = style.shadowColor !== "transparent" && (
      style.shadowBlur > 0 ||
      style.shadowOffsetX !== 0 ||
      style.shadowOffsetY !== 0
    );
    mesh.text = text;
    mesh.font = style.fontSpec.troikaFontUrl;
    mesh.fontSize = style.fontSpec.fontSizePx;
    mesh.fontStyle = style.fontSpec.fontStyle;
    mesh.fontWeight = style.fontSpec.fontWeight;
    mesh.color = style.color;
    mesh.textAlign = anchorX;
    mesh.anchorX = anchorX;
    mesh.anchorY = anchorY;
    mesh.strokeColor = "transparent";
    mesh.strokeWidth = 0;
    mesh.strokeOpacity = 0;
    mesh.fillOpacity = alpha;
    if (hasStroke) {
      mesh.outlineWidth = style.strokeWidth;
      mesh.outlineColor = style.strokeColor;
      mesh.outlineBlur = 0;
      mesh.outlineOffsetX = 0;
      mesh.outlineOffsetY = 0;
      mesh.outlineOpacity = alpha;
    } else if (hasShadow) {
      mesh.outlineWidth = 0;
      mesh.outlineColor = style.shadowColor;
      mesh.outlineBlur = style.shadowBlur;
      mesh.outlineOffsetX = style.shadowOffsetX;
      mesh.outlineOffsetY = -style.shadowOffsetY;
      mesh.outlineOpacity = alpha;
    } else {
      mesh.outlineWidth = 0;
      mesh.outlineColor = "transparent";
      mesh.outlineBlur = 0;
      mesh.outlineOffsetX = 0;
      mesh.outlineOffsetY = 0;
      mesh.outlineOpacity = 0;
    }
    mesh.frustumCulled = false;
  }

  private enforceTextCacheSize() {
    while (this.textCache.size > MAX_TEXT_CACHE_SIZE) {
      let oldestKey: string | null = null;
      let oldestFrame = Number.POSITIVE_INFINITY;

      for (const [key, entry] of this.textCache.entries()) {
        if (entry.frameLastUsed < oldestFrame) {
          oldestFrame = entry.frameLastUsed;
          oldestKey = key;
        }
      }

      if (oldestKey === null) {
        break;
      }

      const entry = this.textCache.get(oldestKey);
      if (entry) entry.mesh.dispose();
      this.textCache.delete(oldestKey);
    }

    while (this.textMeasureCache.size > MAX_TEXT_CACHE_SIZE) {
      let oldestKey: string | null = null;
      let oldestFrame = Number.POSITIVE_INFINITY;

      for (const [key, entry] of this.textMeasureCache.entries()) {
        if (entry.frameLastUsed < oldestFrame) {
          oldestFrame = entry.frameLastUsed;
          oldestKey = key;
        }
      }

      if (oldestKey === null) {
        break;
      }

      const entry = this.textMeasureCache.get(oldestKey);
      if (entry) entry.mesh.dispose();
      this.textMeasureCache.delete(oldestKey);
    }
  }

  private evictUnusedTextCacheEntries() {
    const minFrame = this.frameCounter - TEXT_CACHE_FRAME_TTL;
    for (const [key, entry] of this.textCache.entries()) {
      if (entry.frameLastUsed < minFrame) {
        entry.mesh.dispose();
        this.textCache.delete(key);
      }
    }
    for (const [key, entry] of this.textMeasureCache.entries()) {
      if (entry.frameLastUsed < minFrame) {
        entry.mesh.dispose();
        this.textMeasureCache.delete(key);
      }
    }
  }

  private getOrCreateImageTexture(image: TexImageSource) {
    const key = image as object;
    const cached = this.imageCache.get(key);
    const texture = cached ?? this.gl.createTexture();
    if (!texture) return null;

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);

    if (!cached) {
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

      const width = (image as any).width || (image as any).naturalWidth;
      const height = (image as any).height || (image as any).naturalHeight;

      if (isPowerOfTwo(width) && isPowerOfTwo(height)) {
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
      } else {
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      }

      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      this.imageCache.set(key, texture);
    }

    return texture;
  }
}

export function createWebGLRenderer(options: WebGLRendererOptions) {
  return new WebGLRenderer(options);
}

let activeWebGLRenderer: WebGLRenderer | null = null;

export function setActiveWebGLRenderer(renderer: WebGLRenderer | null) {
  activeWebGLRenderer = renderer;
}

export function getActiveWebGLRenderer(): WebGLRenderer {
  if (!activeWebGLRenderer) {
    throw new Error("WebGL renderer is not initialized");
  }
  return activeWebGLRenderer;
}

function mustCreateProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string) {
  const vertexShader = mustCreateShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = mustCreateShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();

  if (!program) {
    throw new Error("Failed to create WebGL program");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || "unknown program link error";
    gl.deleteProgram(program);
    throw new Error(`Failed to link WebGL program: ${log}`);
  }

  return program;
}

function mustCreateShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create WebGL shader");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || "unknown shader compile error";
    gl.deleteShader(shader);
    throw new Error(`Failed to compile WebGL shader: ${log}`);
  }

  return shader;
}

function mustGetUniform(gl: WebGLRenderingContext, program: WebGLProgram, name: string) {
  const location = gl.getUniformLocation(program, name);
  if (!location) {
    throw new Error(`Missing required uniform: ${name}`);
  }
  return location;
}

function mustCreateBuffer(gl: WebGLRenderingContext) {
  const buffer = gl.createBuffer();
  if (!buffer) {
    throw new Error("Failed to create WebGL buffer");
  }
  return buffer;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function parseFontSizePx(font: string, fallback = 16) {
  const match = /(\d+(?:\.\d+)?)px/.exec(font || "");
  if (!match) return fallback;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFontSpec(font: string): ParsedFontSpec {
  const normalized = (font || DEFAULT_FONT).trim();
  const fontSizePx = parseFontSizePx(normalized, 16);
  const weightMatch = /\b([1-9]00|normal|bold)\b/i.exec(normalized);
  const weightValue = weightMatch ? weightMatch[1].toLowerCase() : "normal";
  const isBold = weightValue === "bold" || Number(weightValue) >= 600;
  const fontWeight: "normal" | "bold" = isBold ? "bold" : "normal";
  const fontStyle: "normal" | "italic" = /\bitalic\b/i.test(normalized) ? "italic" : "normal";
  const sizeMatch = /(\d+(?:\.\d+)?)px/.exec(normalized);
  let fontFamily = "Inter";
  if (sizeMatch) {
    const start = sizeMatch.index + sizeMatch[0].length;
    const rawFamily = normalized.slice(start).trim();
    if (rawFamily.length > 0) {
      fontFamily = rawFamily.replace(/["']/g, "").split(",")[0].trim() || "Inter";
    }
  }

  return {
    fontFamily,
    fontSizePx,
    fontWeight,
    fontStyle,
    troikaFontUrl: fontWeight === "bold" ? INTER_BOLD_FONT_URL : INTER_REGULAR_FONT_URL
  };
}

function mapTextAlign(align: CanvasTextAlign): "left" | "center" | "right" {
  if (align === "center") return "center";
  if (align === "right" || align === "end") return "right";
  return "left";
}

function mapTextBaseline(baseline: CanvasTextBaseline): "top" | "top-baseline" | "middle" | "bottom" | "bottom-baseline" {
  if (baseline === "top" || baseline === "hanging") return "top";
  if (baseline === "middle") return "middle";
  if (baseline === "bottom") return "bottom";
  if (baseline === "ideographic") return "bottom-baseline";
  return "top-baseline";
}

function estimateTextWidth(text: string, fontSizePx: number) {
  return text.length * fontSizePx * 0.62;
}

function readTextWidth(mesh: Text, fallback: number) {
  const bounds = mesh.textRenderInfo?.blockBounds;
  if (Array.isArray(bounds) && bounds.length === 4) {
    const width = Number(bounds[2]) - Number(bounds[0]);
    if (Number.isFinite(width) && width >= 0) {
      return width;
    }
  }
  mesh.geometry?.computeBoundingBox?.();
  const box = mesh.geometry?.boundingBox;
  if (box) {
    const width = box.max.x - box.min.x;
    if (Number.isFinite(width) && width >= 0) {
      return width;
    }
  }
  return fallback;
}

function isRenderableImage(image: TexImageSource): image is TexImageSource {
  if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) {
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  }
  if (typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement) {
    return image.width > 0 && image.height > 0;
  }
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
    return image.width > 0 && image.height > 0;
  }
  if (typeof HTMLVideoElement !== "undefined" && image instanceof HTMLVideoElement) {
    return image.videoWidth > 0 && image.videoHeight > 0;
  }
  return false;
}
function isPowerOfTwo(value: number) {
  return value > 0 && (value & (value - 1)) === 0;
}
