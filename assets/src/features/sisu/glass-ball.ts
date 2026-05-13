import * as THREE from "three";
import type { WebGLRenderer } from "../../renderer/webgl";

type GlassBallRuntime = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  group: THREE.Group;
  ball: THREE.Mesh;
  rim: THREE.Mesh;
  lastTimestampMs: number;
};

let runtime: GlassBallRuntime | null = null;
const BALL_SAFE_PADDING_PX = 8;

function getNowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return 0;
}

function createBodyMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vec3 viewDir = normalize(vViewPosition);
        float ndv = max(dot(normalize(vNormal), viewDir), 0.0);
        float edge = pow(1.0 - ndv, 1.65);

        // Keep center highly transparent and let only edges/readability build up.
        float alpha = 0.012 + edge * 0.075;
        vec3 tintA = vec3(0.70, 0.87, 0.98);
        vec3 tintB = vec3(0.88, 0.96, 1.0);
        vec3 color = mix(tintA, tintB, edge * 0.55);

        // Premultiplied output matches renderer blend mode (ONE, ONE_MINUS_SRC_ALPHA).
        gl_FragColor = vec4(color * alpha, alpha);
      }
    `
  });
}

function createRimMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 2.5);
        gl_FragColor = vec4(vec3(0.66, 0.86, 1.0), fresnel * 0.12);
      }
    `
  });
}

function ensureRuntime(): GlassBallRuntime {
  if (runtime) return runtime;

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 2.42);

  const group = new THREE.Group();
  scene.add(group);

  const sphereGeometry = new THREE.SphereGeometry(1, 88, 88);
  const ball = new THREE.Mesh(sphereGeometry, createBodyMaterial());
  const rim = new THREE.Mesh(new THREE.SphereGeometry(1.006, 88, 88), createRimMaterial());

  group.add(ball);
  group.add(rim);

  runtime = {
    scene,
    camera,
    group,
    ball,
    rim,
    lastTimestampMs: 0
  };
  return runtime;
}

export function renderSisuGlassBall(
  renderer: WebGLRenderer,
  centerX: number,
  centerY: number,
  radiusPx: number
) {
  const nextRuntime = ensureRuntime();
  const nowMs = getNowMs();
  const lastMs = nextRuntime.lastTimestampMs || nowMs;
  nextRuntime.lastTimestampMs = nowMs;
  const dt = Math.min(Math.max((nowMs - lastMs) / 1000, 0), 0.033);
  const t = nowMs / 1000;

  nextRuntime.group.rotation.y += dt * 0.1;
  nextRuntime.group.rotation.x = Math.sin(t * 0.6) * 0.008;

  const viewportRadius = radiusPx + BALL_SAFE_PADDING_PX;
  const fitScale = radiusPx / viewportRadius;
  nextRuntime.group.scale.setScalar(fitScale);

  const size = Math.max(1, Math.round(viewportRadius * 2));
  renderer.drawThreeScene({
    scene: nextRuntime.scene,
    camera: nextRuntime.camera,
    x: Math.round(centerX - viewportRadius),
    y: Math.round(centerY - viewportRadius),
    width: size,
    height: size
  });
}
