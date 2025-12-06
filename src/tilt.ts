import { send as sendNet, isConnected } from "./ws";

type Options = {
  axis?: "left" | "right";
  maxDeg?: number;
  deadzone?: number;
  smooth?: number;
  minIntervalMs?: number;
  invertX?: boolean;
  invertY?: boolean;
};

let running = false;
let lastSend = 0;
let emaX = 0;
let emaY = 0;

let lastG: { x: number; y: number; z: number } | null = null;
let baselinePlanar: { x: number; y: number } = { x: 0, y: 0 };

let stopFn: (() => void) | null = null;

function clamp(v: number, lo = -1, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

function ema(cur: number, prev: number, a: number) {
  return prev * a + cur * (1 - a);
}

function orientationAngle(): number {
  const so = (screen as any).orientation?.angle;
  if (typeof so === "number") return ((so % 360) + 360) % 360;
  const wo = (window as any).orientation;
  if (typeof wo === "number") return ((wo % 360) + 360) % 360;
  // As a last resort, assume portrait-up
  return 0;
}

function rad(n: number) {
  return (n * Math.PI) / 180;
}

// tilt.ts
export async function requestSensors() {
  // iOS requires a user gesture for these *calls* themselves
  const hasDM = typeof DeviceMotionEvent !== "undefined";
  const hasDO = typeof DeviceOrientationEvent !== "undefined";

  // iOS 13+ permission gate
  // (These properties only exist on iOS; harmless elsewhere.)
  // Must run inside a user gesture handler.
  // If either gets granted, you're good.
  try {
    if (
      hasDM &&
      typeof (DeviceMotionEvent as any).requestPermission === "function"
    ) {
      const res = await (DeviceMotionEvent as any).requestPermission();
      if (res !== "granted") throw new Error("devicemotion denied");
    }
  } catch (err) {
    console.log(err);
  }

  try {
    if (
      hasDO &&
      typeof (DeviceOrientationEvent as any).requestPermission === "function"
    ) {
      const res = await (DeviceOrientationEvent as any).requestPermission();
      if (res !== "granted") throw new Error("deviceorientation denied");
    }
  } catch (err) {
    console.log(err);
  }
}

function planarFromDeviceG(
  gx: number,
  gy: number,
  gz: number
): { x: number; y: number } {
  switch (orientationAngle()) {
    case 0:
      return { x: gx, y: -gy };
    case 90:
      return { x: -gy, y: -gx };
    case 180:
      return { x: -gx, y: gy };
    case 270:
      return { x: gy, y: gx };
    default:
      return { x: gx, y: -gy };
  }
}

function vecLen(x: number, y: number) {
  return Math.hypot(x, y);
}

function normalize(x: number, y: number) {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l, l };
}

function applyRadialDeadzone(x: number, y: number, dz: number) {
  const { x: nx, y: ny, l } = normalize(x, y);
  if (l < dz) return { x: 0, y: 0 };
  const s = (l - dz) / (1 - dz);
  return { x: nx * s, y: ny * s };
}

function synthesizeGFromOrientation(
  beta: number,
  gamma: number
): { x: number; y: number; z: number } {
  const B = rad(beta || 0);
  const G = rad(gamma || 0);
  const x = Math.sin(G);
  const y = -Math.sin(B);
  const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
  return { x, y, z };
}

export function calibrate() {
  if (!lastG) return;
  const p = planarFromDeviceG(lastG.x, lastG.y, lastG.z);
  baselinePlanar = { x: p.x, y: p.y };
}

export async function requestMotionPermissionIfNeeded() {
  if (
    typeof DeviceMotionEvent !== "undefined" &&
    typeof (DeviceMotionEvent as any).requestPermission === "function"
  ) {
    const res = await (DeviceMotionEvent as any).requestPermission();
    if (res !== "granted") throw new Error("motion permission denied");
  }
}

export function startTilt(opts: Partial<Options> = {}) {
  if (running) return;
  const cfg: Required<Options> = {
    axis: opts.axis ?? "right",
    maxDeg: opts.maxDeg ?? 28,
    deadzone: opts.deadzone ?? 0.07,
    smooth: opts.smooth ?? 0.3,
    minIntervalMs: opts.minIntervalMs ?? 16,
    invertX: !!opts.invertX,
    invertY: !!opts.invertY,
  };

  running = true;
  emaX = 0;
  emaY = 0;
  lastSend = 0;

  const onMotion = (e: DeviceMotionEvent) => {
    const ag = (e as any).accelerationIncludingGravity;
    if (!ag) return;
    let gx = Number(ag.x ?? 0);
    let gy = Number(ag.y ?? 0);
    let gz = Number(ag.z ?? 0);

    const m = Math.hypot(gx, gy, gz) || 1;
    gx /= m;
    gy /= m;
    gz /= m;

    lastG = { x: gx, y: gy, z: gz };
    tick();
  };

  const onOrientation = (e: DeviceOrientationEvent) => {
    if (lastG) return;
    const beta = e.beta ?? 0;
    const gamma = e.gamma ?? 0;
    lastG = synthesizeGFromOrientation(beta, gamma);
    tick();
  };

  function tick() {
    if (!lastG) return;

    const p = planarFromDeviceG(lastG.x, lastG.y, lastG.z);
    let vx = p.x - baselinePlanar.x;
    let vy = p.y - baselinePlanar.y;

    const maxRad = rad(cfg.maxDeg);
    const { x: dirx, y: diry, l } = normalize(vx, vy);
    let mag = l / Math.max(1e-6, Math.sin(maxRad));
    mag = clamp(mag, 0, 1);
    vx = dirx * mag;
    vy = diry * mag;

    if (cfg.invertX) vx = -vx;
    if (cfg.invertY) vy = -vy;

    const dz = applyRadialDeadzone(vx, vy, cfg.deadzone);
    const sx = ema(dz.x, emaX, cfg.smooth);
    const sy = ema(dz.y, emaY, cfg.smooth);
    emaX = sx;
    emaY = sy;

    const now = performance.now();
    if (now - lastSend < cfg.minIntervalMs) return;

    lastSend = now;
    if (!isConnected()) return;

    const payload =
      cfg.axis === "right"
        ? {
            type: "state",
            rx: Number(sx.toFixed(3)),
            ry: Number(sy.toFixed(3)),
          }
        : {
            type: "state",
            lx: Number(sx.toFixed(3)),
            ly: Number(sy.toFixed(3)),
          };

    sendNet(payload);
  }

  window.addEventListener("devicemotion", onMotion);
  window.addEventListener("deviceorientation", onOrientation);

  stopFn = () => {
    window.removeEventListener("devicemotion", onMotion);
    window.removeEventListener("deviceorientation", onOrientation);
    running = false;
  };
}

export function stopTilt() {
  if (stopFn) stopFn();
  running = false;
}
