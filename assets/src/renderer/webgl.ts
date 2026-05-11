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
}

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

interface TextSprite {
  texture: WebGLTexture;
  width: number;
  height: number;
  textX: number;
  textWidth: number;
  ascent: number;
  descent: number;
  baselineY: number;
}

interface TextSpriteStyle {
  color: string;
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
}

const DEFAULT_FONT = "bold 16px Arial";
const DEFAULT_TEXT_COLOR = "#ffffff";
const MAX_TEXT_CACHE_SIZE = 256;

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
  gl_FragColor = vec4(sampled.rgb, sampled.a * u_alpha);
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

  private readonly textMeasureCanvas: HTMLCanvasElement;
  private readonly textMeasureCtx: CanvasRenderingContext2D;
  private readonly textCache = new Map<string, TextSprite>();
  private readonly imageCache = new WeakMap<object, WebGLTexture>();

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

    this.textMeasureCanvas = document.createElement("canvas");
    const measureCtx = this.textMeasureCanvas.getContext("2d");
    if (!measureCtx) {
      throw new Error("WebGLRenderer requires a 2d text measurement context");
    }
    this.textMeasureCtx = measureCtx;

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  resize(width: number, height: number) {
    const nextWidth = Math.max(1, Math.floor(Number(width) || this.canvas.width || 1));
    const nextHeight = Math.max(1, Math.floor(Number(height) || this.canvas.height || 1));

    if (this.canvas.width !== nextWidth) this.canvas.width = nextWidth;
    if (this.canvas.height !== nextHeight) this.canvas.height = nextHeight;

    this.gl.viewport(0, 0, nextWidth, nextHeight);
  }

  beginFrame(clearColor: RGBA = [0, 0, 0, 0]) {
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
    gl.uniform4f(this.colorUniformLocation, color[0], color[1], color[2], color[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  drawCircle(x: number, y: number, radius: number, color: RGBA) {
    const diameter = Math.max(0, radius * 2);
    if (diameter <= 0) return;
    this.drawRect({
      x: x - radius,
      y: y - radius,
      width: diameter,
      height: diameter,
      color
    });
  }

  drawImage(options: DrawImageOptions) {
    const gl = this.gl;
    const { image, x, y, width, height } = options;
    const alpha = clamp01(options.alpha ?? 1);
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
    gl.uniform1f(this.textAlphaLocation, alpha);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.textTextureLocation, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  drawText(options: DrawTextOptions) {
    const gl = this.gl;
    const text = options.text;
    if (!text) return;

    const font = options.font || DEFAULT_FONT;
    const color = options.color || DEFAULT_TEXT_COLOR;
    const strokeColor = options.strokeColor || "transparent";
    const strokeWidth = Math.max(0, Number(options.strokeWidth) || 0);
    const shadowColor = options.shadowColor || "transparent";
    const shadowBlur = Math.max(0, Number(options.shadowBlur) || 0);
    const shadowOffsetX = Number(options.shadowOffsetX) || 0;
    const shadowOffsetY = Number(options.shadowOffsetY) || 0;
    const align = options.align || "left";
    const baseline = options.baseline || "alphabetic";
    const alpha = clamp01(options.alpha ?? 1);

    const sprite = this.getOrCreateTextSprite(text, font, {
      color,
      strokeColor,
      strokeWidth,
      shadowColor,
      shadowBlur,
      shadowOffsetX,
      shadowOffsetY
    });
    const anchorX = computeAnchorX(sprite, align);
    const anchorY = computeAnchorY(sprite, baseline);

    const x = options.x - anchorX;
    const y = options.y - anchorY;
    const x2 = x + sprite.width;
    const y2 = y + sprite.height;

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
    gl.uniform1f(this.textAlphaLocation, alpha);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sprite.texture);
    gl.uniform1i(this.textTextureLocation, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  measureTextWidth(options: MeasureTextOptions) {
    const text = String(options.text ?? "");
    const font = options.font || DEFAULT_FONT;
    this.textMeasureCtx.font = font;
    return this.textMeasureCtx.measureText(text).width;
  }

  clearTextCache() {
    const gl = this.gl;
    for (const sprite of this.textCache.values()) {
      gl.deleteTexture(sprite.texture);
    }
    this.textCache.clear();
  }

  dispose() {
    const gl = this.gl;
    this.clearTextCache();
    gl.deleteBuffer(this.colorBuffer);
    gl.deleteBuffer(this.textPositionBuffer);
    gl.deleteBuffer(this.textTexcoordBuffer);
    gl.deleteProgram(this.colorProgram);
    gl.deleteProgram(this.textProgram);
  }

  private getOrCreateTextSprite(text: string, font: string, style: TextSpriteStyle) {
    const key = [
      text,
      font,
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
      return cached;
    }

    const sprite = this.createTextSprite(text, font, style);

    if (this.textCache.size >= MAX_TEXT_CACHE_SIZE) {
      const firstKey = this.textCache.keys().next().value;
      if (typeof firstKey === "string") {
        const firstSprite = this.textCache.get(firstKey);
        if (firstSprite) {
          this.gl.deleteTexture(firstSprite.texture);
        }
        this.textCache.delete(firstKey);
      }
    }

    this.textCache.set(key, sprite);
    return sprite;
  }

  private createTextSprite(text: string, font: string, style: TextSpriteStyle): TextSprite {
    const gl = this.gl;
    const measure = this.textMeasureCtx;
    measure.font = font;
    measure.textAlign = "left";
    measure.textBaseline = "alphabetic";

    const metrics = measure.measureText(text);
    const fontSize = parseFontSizePx(font);
    const ascent = Math.ceil(metrics.actualBoundingBoxAscent || fontSize * 0.82);
    const descent = Math.ceil(metrics.actualBoundingBoxDescent || fontSize * 0.28);
    const strokePad = Math.ceil(style.strokeWidth);
    const shadowPadX = Math.ceil(Math.abs(style.shadowOffsetX) + style.shadowBlur);
    const shadowPadY = Math.ceil(Math.abs(style.shadowOffsetY) + style.shadowBlur);
    const padX = 1 + strokePad + shadowPadX;
    const padY = 1 + strokePad + shadowPadY;
    const width = Math.max(1, Math.ceil(metrics.width + padX * 2));
    const height = Math.max(1, Math.ceil(ascent + descent + padY * 2));

    const textCanvas = document.createElement("canvas");
    textCanvas.width = width;
    textCanvas.height = height;
    const textCtx = textCanvas.getContext("2d");

    if (!textCtx) {
      throw new Error("WebGLRenderer failed to create text sprite context");
    }

    textCtx.clearRect(0, 0, width, height);
    textCtx.font = font;
    textCtx.textAlign = "left";
    textCtx.textBaseline = "alphabetic";
    const textX = padX;
    const textY = padY + ascent;
    textCtx.shadowColor = style.shadowColor;
    textCtx.shadowBlur = style.shadowBlur;
    textCtx.shadowOffsetX = style.shadowOffsetX;
    textCtx.shadowOffsetY = style.shadowOffsetY;
    if (style.strokeWidth > 0 && style.strokeColor !== "transparent") {
      textCtx.lineJoin = "round";
      textCtx.lineWidth = style.strokeWidth;
      textCtx.strokeStyle = style.strokeColor;
      textCtx.strokeText(text, textX, textY);
    }
    textCtx.fillStyle = style.color;
    textCtx.fillText(text, textX, textY);

    const texture = gl.createTexture();
    if (!texture) {
      throw new Error("WebGLRenderer failed to create text texture");
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return {
      texture,
      width,
      height,
      textX,
      textWidth: Math.max(0, metrics.width),
      ascent,
      descent,
      baselineY: textY
    };
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
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
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

export function getActiveWebGLRenderer() {
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

function computeAnchorX(sprite: TextSprite, align: CanvasTextAlign) {
  if (align === "center") return sprite.textX + sprite.textWidth / 2;
  if (align === "right" || align === "end") return sprite.textX + sprite.textWidth;
  return sprite.textX;
}

function computeAnchorY(sprite: TextSprite, baseline: CanvasTextBaseline) {
  if (baseline === "alphabetic") return sprite.baselineY;
  const textTop = sprite.baselineY - sprite.ascent;
  const textBottom = sprite.baselineY + sprite.descent;
  if (baseline === "middle") return textTop + (textBottom - textTop) / 2;
  if (baseline === "bottom" || baseline === "ideographic") return textBottom;
  if (baseline === "top" || baseline === "hanging") return textTop;
  return sprite.baselineY;
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
  if (typeof OffscreenCanvas !== "undefined" && image instanceof OffscreenCanvas) {
    return image.width > 0 && image.height > 0;
  }
  if (typeof HTMLVideoElement !== "undefined" && image instanceof HTMLVideoElement) {
    return image.videoWidth > 0 && image.videoHeight > 0;
  }
  return false;
}
