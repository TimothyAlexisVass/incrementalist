import * as THREE from "three";
import type { WebGLRenderer } from "../../renderer/webgl";

export type SisuCrystalTier = "azure" | "aether" | "lucent" | "transcendent";

type CrystalPalette = {
  color: number;
  emissive: number;
  attenuation: number;
  sparkleA: number;
  sparkleB: number;
  fillLight: number;
  backLight: number;
  hemiSky: number;
  keyLight: number;
};

const CRYSTAL_PALETTES: Record<SisuCrystalTier, CrystalPalette> = {
  azure: {
    color: 0x2e50ff,
    emissive: 0x0044ff,
    attenuation: 0xffffff,
    sparkleA: 0xffffff,
    sparkleB: 0xffffff,
    fillLight: 0x9999ff,
    backLight: 0x0000ff,
    hemiSky: 0x3e99ff,
    keyLight: 0xffffff
  },
  aether: {
    color: 0xffffff,
    emissive: 0xff00ff,
    attenuation: 0xff00ff,
    sparkleA: 0xffffff,
    sparkleB: 0xff66ff,
    fillLight: 0x4b0082,
    backLight: 0x4b8882,
    hemiSky: 0xffffff,
    keyLight: 0xffffff
  },
  lucent: {
    color: 0xffffff,
    emissive: 0xff8c1a,
    attenuation: 0xff8c1a,
    sparkleA: 0xffffff,
    sparkleB: 0xffff00,
    fillLight: 0xff0000,
    backLight: 0xff0000,
    hemiSky: 0xff0000,
    keyLight: 0xff0000
  },
  transcendent: {
    color: 0xf5f7fa,
    emissive: 0xdff6ff,
    attenuation: 0xdff6ff,
    sparkleA: 0xffffff,
    sparkleB: 0xdff6ff,
    fillLight: 0x9bb8d6,
    backLight: 0x9bb8d6,
    hemiSky: 0xf5f7fa,
    keyLight: 0xffffff
  }
};

type CrystalRuntime = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  crystalGroup: THREE.Group;
  crystalMaterial: THREE.MeshPhysicalMaterial;
  sparkleGroup: THREE.Group;
  sparkleMaterials: THREE.MeshBasicMaterial[];
  keyLight: THREE.PointLight;
  fillLight: THREE.PointLight;
  backLight: THREE.PointLight;
  hemiLight: THREE.HemisphereLight;
  activeTier: SisuCrystalTier;
  angularVelocity: THREE.Vector3;
  targetAngularVelocity: THREE.Vector3;
  nextTargetIn: number;
  deltaRotation: THREE.Quaternion;
  tmpAxis: THREE.Vector3;
  lastTimestampMs: number;
};

let runtime: CrystalRuntime | null = null;

function createCrystalGeometry() {
  const geometry = new THREE.IcosahedronGeometry(1.45, 3).toNonIndexed();
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();

    const d1 = Math.sin(n.x * 7.0 + n.y * 3.7 + n.z * 2.9) * 0.055;
    const d2 = Math.cos(n.y * 8.3 - n.z * 6.2) * 0.04;
    const d3 = Math.sin((n.x - n.z) * 11.0) * 0.022;
    const d4 = Math.cos((n.x + n.y + n.z) * 14.0) * 0.018;

    let radius = 1.0 + d1 + d2 + d3 + d4;
    radius = Math.round(radius * 22.0) / 22.0;

    v.copy(n).multiplyScalar(1.45 * radius);
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geometry.computeVertexNormals();
  return geometry;
}

function pickNewAngularTarget(nextRuntime: CrystalRuntime) {
  const axis = new THREE.Vector3(
    Math.random() * 2 - 1,
    Math.random() * 2 - 1,
    Math.random() * 2 - 1
  ).normalize();

  const speed = THREE.MathUtils.randFloat(2.6, 3.92);
  nextRuntime.targetAngularVelocity.copy(axis.multiplyScalar(speed));
  nextRuntime.nextTargetIn = THREE.MathUtils.randFloat(2.5, 5.5);
}

function ensureRuntime(): CrystalRuntime | null {
  if (runtime) return runtime;

  const scene = new THREE.Scene();
  scene.background = null;
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 5.8);

  const crystalGroup = new THREE.Group();
  scene.add(crystalGroup);

  const crystalMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x67d4ff),
    emissive: new THREE.Color(0x144cff),
    emissiveIntensity: 0.8,
    roughness: 0.05,
    metalness: 0.0,
    transmission: 1.1,
    thickness: 9.4,
    ior: 99.5,
    reflectivity: 9.6,
    attenuationColor: new THREE.Color(0x1196ff),
    attenuationDistance: 1.95,
    clearcoat: 1.0,
    clearcoatRoughness: 0.01,
    transparent: true,
    opacity: 0.99,
    flatShading: true,
    side: THREE.DoubleSide
  });
  const crystal = new THREE.Mesh(createCrystalGeometry(), crystalMaterial);
  crystalGroup.add(crystal);

  const sparkleGroup = new THREE.Group();
  const sparkleMaterials: THREE.MeshBasicMaterial[] = [];
  crystalGroup.add(sparkleGroup);

  for (let i = 0; i < 9; i += 1) {
    const g = new THREE.OctahedronGeometry(0.08 + Math.random() * 0.05, 0);
    const m = new THREE.MeshBasicMaterial({
      color: Math.random() > 0.85 ? 0xb8ffff : 0x61beff,
      transparent: true,
      opacity: 0.35
    });
    sparkleMaterials.push(m);
    const s = new THREE.Mesh(g, m);

    const dir = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).normalize();
    const radius = 0.15 + Math.random() * 3.82;
    s.position.copy(dir.multiplyScalar(radius));
    s.userData.variant = Math.random() > 0.65 ? "a" : "b";
    s.userData.phase = Math.random() * Math.PI * 2;
    s.userData.baseScale = 0.75 + Math.random() * 0.75;
    sparkleGroup.add(s);
  }

  const keyLight = new THREE.PointLight(0xffffff, 80, 15);
  keyLight.position.set(4.1, 2.8, 3.8);
  scene.add(keyLight);

  const fillLight = new THREE.PointLight(0x4b9dff, 8, 12);
  fillLight.position.set(-2.7, -1.8, 2.0);
  scene.add(fillLight);

  const backLight = new THREE.PointLight(0x1f5fff, 10, 14);
  backLight.position.set(0, 0.3, -4.3);
  scene.add(backLight);

  const hemiLight = new THREE.HemisphereLight(0x8ce6ff, 0x03101f, 1.0);
  scene.add(hemiLight);

  runtime = {
    scene,
    camera,
    crystalGroup,
    crystalMaterial,
    sparkleGroup,
    sparkleMaterials,
    keyLight,
    fillLight,
    backLight,
    hemiLight,
    activeTier: "azure",
    angularVelocity: new THREE.Vector3(9.8, 9.52, 9.05),
    targetAngularVelocity: new THREE.Vector3(4.08, 3.12, 6.05),
    nextTargetIn: 0,
    deltaRotation: new THREE.Quaternion(),
    tmpAxis: new THREE.Vector3(),
    lastTimestampMs: 0
  };

  pickNewAngularTarget(runtime);
  applyPalette(runtime, "azure");
  return runtime;
}

function applyPalette(nextRuntime: CrystalRuntime, tier: SisuCrystalTier) {
  const palette = CRYSTAL_PALETTES[tier];
  nextRuntime.crystalMaterial.color.setHex(palette.color);
  nextRuntime.crystalMaterial.emissive.setHex(palette.emissive);
  nextRuntime.crystalMaterial.attenuationColor.setHex(palette.attenuation);
  nextRuntime.fillLight.color.setHex(palette.fillLight);
  nextRuntime.backLight.color.setHex(palette.backLight);
  nextRuntime.hemiLight.color.setHex(palette.hemiSky);
  nextRuntime.keyLight.color.setHex(palette.keyLight);

  nextRuntime.sparkleGroup.children.forEach((child, index) => {
    const material = nextRuntime.sparkleMaterials[index];
    if (!material) return;
    const variant = String(child.userData.variant || "a");
    material.color.setHex(variant === "b" ? palette.sparkleB : palette.sparkleA);
  });
}

function getNowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return 0;
}

export function renderSisuCrystal(
  renderer: WebGLRenderer,
  centerX: number,
  centerY: number,
  sizePx = 20,
  tier: SisuCrystalTier = "azure"
) {
  const nextRuntime = ensureRuntime();
  if (!nextRuntime) return;
  if (nextRuntime.activeTier !== tier) {
    applyPalette(nextRuntime, tier);
    nextRuntime.activeTier = tier;
  }

  const nowMs = getNowMs();
  const lastMs = nextRuntime.lastTimestampMs || nowMs;
  nextRuntime.lastTimestampMs = nowMs;
  const dt = Math.min(Math.max((nowMs - lastMs) / 1000, 0), 0.033);
  const t = nowMs / 1000;

  nextRuntime.nextTargetIn -= dt;
  if (nextRuntime.nextTargetIn <= 0) {
    pickNewAngularTarget(nextRuntime);
  }

  nextRuntime.angularVelocity.lerp(nextRuntime.targetAngularVelocity, dt * 0.45);

  const angle = nextRuntime.angularVelocity.length() * dt;
  if (angle > 0.000001) {
    nextRuntime.tmpAxis.copy(nextRuntime.angularVelocity).normalize();
    nextRuntime.deltaRotation.setFromAxisAngle(nextRuntime.tmpAxis, angle);
    nextRuntime.crystalGroup.quaternion.premultiply(nextRuntime.deltaRotation);
  }

  nextRuntime.sparkleGroup.children.forEach((child, index) => {
    const phase = Number(child.userData.phase || 0);
    const baseScale = Number(child.userData.baseScale || 1);
    const pulse = 0.82 + Math.sin(t * 2.4 + phase) * 0.33;
    const scale = baseScale * pulse;
    child.scale.setScalar(scale);
    child.rotation.x += dt * (0.4 + index * 0.01);
    child.rotation.y += dt * (0.55 + index * 0.012);
  });

  nextRuntime.keyLight.intensity = 0.9 + Math.sin(t * 2.2) * 1.3;
  nextRuntime.fillLight.intensity = 0.4 + Math.cos(t * 1.35) * 1.6;
  let baseIntensity = tier == "lucent" ? 1.28 : 1.88;
  nextRuntime.crystalMaterial.emissiveIntensity = baseIntensity + Math.sin(t * 0.85) * (baseIntensity / 1.3);

  const size = Math.max(1, Math.round(sizePx));
  renderer.drawThreeScene({
    scene: nextRuntime.scene,
    camera: nextRuntime.camera,
    x: centerX - size / 2,
    y: centerY - size / 2,
    width: size,
    height: size
  });
}
