import { useEffect, useRef, useState } from "react";
import {
  connectController,
  disconnectController,
  send,
  isConnected,
} from "../ws";
import { startTilt, stopTilt, calibrate, requestSensors } from "../tilt";
import S4Solo from "../layouts/S4Solo";
import PS2ZoneLayout from "../layouts/PS2ZoneLayout";
import FullscreenButton from "../components/FullscreenButton";

export interface IDpad {
  dir: IDpadDir;
  down: boolean;
}

export type IDpadDir =
  | "up"
  | "down"
  | "left"
  | "right"
  | "upleft"
  | "upright"
  | "downleft"
  | "downright";

export type StickDir = "up" | "down" | "left" | "right";

type DeviceInfo = {
  userAgent: string;
  platform: string;
  language: string;
  screen: {
    width: number;
    height: number;
    pixelRatio: number;
  };
};

function buildDeviceInfo(): DeviceInfo {
  return {
    userAgent: navigator.userAgent,
    platform: (navigator as any).platform || "",
    language: navigator.language || "",
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      pixelRatio: window.devicePixelRatio || 1,
    },
  };
}

function getDeviceSlug(): string {
  const key = "gotv_device_slug";
  let slug = localStorage.getItem(key);
  if (!slug) {
    slug = Math.random().toString(36).slice(2, 6).toUpperCase();
    localStorage.setItem(key, slug);
  }
  return slug;
}

function buildDeviceTag(info: DeviceInfo): string {
  const ua = info.userAgent;
  let os = "Unknown";
  if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Unknown";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = "Opera";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua) && !/OPR\//i.test(ua))
    browser = "Chrome";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";

  let version = "";
  const m = ua.match(/(Chrome|Firefox|Edg|Version)\/(\d+)/i);
  if (m && m[2]) version = m[2];

  const slug = getDeviceSlug();
  const base = `${os} ${browser}${version ? " " + version : ""}`.trim();
  return `${base} • ${slug}`;
}

function sendHello() {
  const deviceInfo = buildDeviceInfo();
  const deviceTag = buildDeviceTag(deviceInfo);
  send({
    type: "hello",
    deviceTag,
    deviceInfo,
  });
}

type ControllerPageProps = {
  layout?: "s4" | "ps2";
};

export default function ControllerPage({ layout = "s4" }: ControllerPageProps) {
  const [status, setStatus] = useState("disconnected");
  const [slot, setSlot] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isTiltActive, setIsTiltActive] = useState(false);
  const tiltOn = useRef(false);

  const dpadUsage = useRef<{
    up: number;
    down: number;
    left: number;
    right: number;
  }>({
    up: 0,
    down: 0,
    left: 0,
    right: 0,
  });

  const stickUsage = useRef<{
    up: number;
    down: number;
    left: number;
    right: number;
  }>({
    up: 0,
    down: 0,
    left: 0,
    right: 0,
  });

  const LayoutComponent = layout === "ps2" ? PS2ZoneLayout : S4Solo;

  useEffect(() => {
    const vis = () => {
      if (document.hidden && tiltOn.current) {
        stopTilt();
      }
    };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, []);

  useEffect(() => {
    let lock: any;
    (async () => {
      try {
        lock = await (navigator as any).wakeLock?.request?.("screen");
      } catch {
        console.log("can't await lock");
      }
    })();
    return () => {
      try {
        lock?.release?.();
      } catch {
        console.log("can't release lock");
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (tiltOn.current) stopTilt();
      tiltOn.current = false;
      disconnectController();
    };
  }, []);

  function connect() {
    setWarning(null);
    setStatus("connecting");

    connectController({
      onOpen: () => {
        setStatus("connected");
        sendHello();
      },
      onMessage: (j: any) => {
        try {
          if (j?.ok && j.index) {
            setSlot(j.index);
            setStatus("ready");
            if (tiltOn.current) {
              setStatus((s) => (s.includes("• tilt") ? s : s + " • tilt"));
            }
          }
          if (j?.info === "slot-changed" && j?.index) {
            setSlot(j.index);
            setStatus(`ready${tiltOn.current ? " • tilt" : ""}`);
          }
          if (j?.ok === false && j?.error) {
            setStatus("error");
            setWarning(j.error);
          }
        } catch (err) {
          console.log(err);
        }
      },
      onClose: () => {
        setStatus("disconnected");
        setSlot(null);
        if (tiltOn.current) {
          stopTilt();
        }
        tiltOn.current = false;
        setIsTiltActive(false);
      },
    }).catch((err) => {
      console.error(err);
      setStatus("error");
      setWarning("Connection failed");
      setSlot(null);
      if (tiltOn.current) {
        stopTilt();
      }
      tiltOn.current = false;
      setIsTiltActive(false);
    });
  }

  function disconnect() {
    disconnectController();
  }

  function press(name: string, down: boolean) {
    if (down) window.navigator.vibrate?.(10);
    send({ type: "state", buttons: { [name]: down } });
  }

  function setAxis(patch: { lx?: number; ly?: number }) {
    send({ type: "state", ...patch });
  }

  function computeCombinedDpad(): IDpadDir | "neutral" {
    const u = dpadUsage.current.up > 0;
    const d = dpadUsage.current.down > 0;
    const l = dpadUsage.current.left > 0;
    const r = dpadUsage.current.right > 0;

    let v: "none" | "up" | "down" = "none";
    if (u && !d) v = "up";
    else if (d && !u) v = "down";

    let h: "none" | "left" | "right" = "none";
    if (l && !r) h = "left";
    else if (r && !l) h = "right";

    if (v === "none" && h === "none") return "neutral";

    if (v === "up" && h === "left") return "upleft";
    if (v === "up" && h === "right") return "upright";
    if (v === "down" && h === "left") return "downleft";
    if (v === "down" && h === "right") return "downright";

    if (v !== "none") return v;
    return h as IDpadDir;
  }

  function pressDpad(dir: IDpadDir, down: boolean) {
    if (down) window.navigator.vibrate?.(10);
    const affected: Array<"up" | "down" | "left" | "right"> = [];

    if (dir === "up" || dir === "upleft" || dir === "upright") {
      affected.push("up");
    }
    if (dir === "down" || dir === "downleft" || dir === "downright") {
      affected.push("down");
    }
    if (dir === "left" || dir === "upleft" || dir === "downleft") {
      affected.push("left");
    }
    if (dir === "right" || dir === "upright" || dir === "downright") {
      affected.push("right");
    }

    const delta = down ? 1 : -1;

    for (const k of affected) {
      const current = dpadUsage.current[k];
      const next = current + delta;
      dpadUsage.current[k] = next < 0 ? 0 : next;
    }

    const combined = computeCombinedDpad();
    send({ type: "state", dpad: combined });
  }

  function pressStick(dir: StickDir, down: boolean) {
    if (down) window.navigator.vibrate?.(10);
    const delta = down ? 1 : -1;
    const current = stickUsage.current[dir];
    const next = current + delta;
    stickUsage.current[dir] = next < 0 ? 0 : next;

    const u = stickUsage.current.up > 0 ? 1 : 0;
    const d = stickUsage.current.down > 0 ? 1 : 0;
    const l = stickUsage.current.left > 0 ? 1 : 0;
    const r = stickUsage.current.right > 0 ? 1 : 0;

    const y = u - d;
    const x = r - l;

    send({ type: "state", lx: x, ly: y });
  }

  function pressShoulder(side: "left" | "right", which: 1 | 2, down: boolean) {
    if (down) window.navigator.vibrate?.(15);
    if (which === 1) {
      if (side === "left") {
        send({
          type: "state",
          buttons: { SHOULDER_LEFT: down },
        });
      } else {
        send({
          type: "state",
          buttons: { SHOULDER_RIGHT: down },
        });
      }
    } else {
      if (side === "left") {
        send({
          type: "state",
          lt: down ? 1 : 0,
        });
      } else {
        send({
          type: "state",
          rt: down ? 1 : 0,
        });
      }
    }
  }

  function toggleTilt() {
    window.navigator.vibrate?.(15);
    if (!isConnected()) return;

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (!tiltOn.current) {
      requestSensors().finally(() => {
        startTilt({
          axis: "right",
          maxDeg: 12,
          deadzone: 0,
          smooth: 0.45,
          invertX: !isIOS,
          invertY: isIOS,
        });
        tiltOn.current = true;
        setIsTiltActive(true);
        setStatus((s) => (s.includes("• tilt") ? s : s + " • tilt"));
      });
    } else {
      stopTilt();
      tiltOn.current = false;
      setIsTiltActive(false);
      setStatus((s) => s.replace(" • tilt", ""));
    }
  }

  const isActuallyReady = status.startsWith("ready");

  return (
    <div className="w-full h-[100dvh] relative touch-none overflow-hidden bg-white">
      {warning && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white p-3 text-center text-sm font-bold flex justify-between items-center animate-in slide-in-from-top">
          <span className="flex-1">⚠️ Server Error: {warning}</span>
          <button
            onClick={() => setWarning(null)}
            className="ml-2 bg-black/20 rounded-full w-6 h-6 flex items-center justify-center"
          >
            ✕
          </button>
        </div>
      )}

      {/* Centered Slot Indicator - z-index increased to sit on top of overlay */}
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[51] flex items-center justify-center pointer-events-none select-none">
        <div className="flex items-center gap-3 rounded-full bg-black/60 text-white px-4 py-2 text-xs">
          <SlotDot lit={slot === 1} n={1} />
          <SlotDot lit={slot === 2} n={2} />
          <SlotDot lit={slot === 3} n={3} />
          <SlotDot lit={slot === 4} n={4} />
        </div>
      </div>

      {/* Connectivity Overlay */}
      {!isActuallyReady && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm px-6 text-center">
          <button
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => {
              window.navigator.vibrate?.(20);
              if (status === "connecting" || status === "connected") {
                disconnect();
              } else {
                connect();
              }
            }}
            className={`
              w-full max-w-xs py-6 rounded-2xl border-2 shadow-2xl transition-all duration-300
              text-lg font-black uppercase tracking-widest pointer-events-auto select-none
              ${
                status === "connecting" || status === "connected"
                  ? "bg-amber-500 border-amber-400 text-white animate-pulse"
                  : "bg-blue-600 border-blue-500 text-white hover:scale-105 active:scale-95"
              }
            `}
          >
            {status === "connecting" || status === "connected"
              ? "Connecting..."
              : "Connect Controller"}
          </button>
          {/* <p className="mt-4 text-slate-500 text-xs font-bold uppercase tracking-tighter opacity-50 select-none">
            TV Gaming Controller
          </p> 
          */}
        </div>
      )}

      {/* Top Right Controls Row */}
      <div className="fixed top-2 right-4 flex flex-col items-end gap-4 z-30 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          {isTiltActive && (
            <button
              onContextMenu={(e) => e.preventDefault()}
              className={`
                rounded-xl border-2 px-4 py-2 text-[10px] leading-tight font-black uppercase italic select-none transition-all duration-75
                bg-slate-100 border-slate-200 text-slate-400 active:text-red-400 active:border-red-200
              `}
              onClick={toggleTilt}
            >
              motion
            </button>
          )}

          <FullscreenButton />

          {isActuallyReady && (
            <button
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => {
                window.navigator.vibrate?.(10);
                disconnect();
              }}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 text-red-600 hover:bg-red-500/20 transition-all active:scale-90 select-none"
              title="Disconnect"
            >
              <span className="text-xl font-bold">✕</span>
            </button>
          )}
        </div>

        {/* Unified Motion Control Button Space */}
        <div
          className={`pointer-events-auto transition-opacity duration-300 ${
            isActuallyReady ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <button
            onContextMenu={(e) => e.preventDefault()}
            className={`
              w-48 h-16 rounded-3xl transition-all duration-75 flex items-center justify-center font-black uppercase tracking-widest text-sm
              active:scale-95 active:shadow-inner select-none
              ${
                isTiltActive
                  ? "bg-orange-500 border-b-4 border-orange-700 text-white shadow-xl active:translate-y-0.5 active:border-b-0"
                  : "bg-white border-2 border-blue-600 text-blue-600 shadow-sm"
              }
            `}
            onClick={() => {
              if (isTiltActive) {
                window.navigator.vibrate?.(40);
                calibrate();
              } else {
                toggleTilt();
              }
            }}
          >
            {isTiltActive ? "RECENTER" : "Enable Motion"}
          </button>
        </div>
      </div>

      <LayoutComponent
        status={status}
        slot={slot}
        onPress={press}
        pressDpad={pressDpad}
        pressShoulder={pressShoulder}
        pressStick={pressStick}
        onAxis={setAxis}
        onCalibrate={calibrate}
        onToggleTilt={toggleTilt}
      />
    </div>
  );
}

function SlotDot({ lit, n }: { lit: boolean; n: number }) {
  return (
    <div
      className={
        "h-3.5 w-3.5 rounded-full transition-all duration-300 " +
        (lit
          ? "bg-green-400 shadow-[0_0_10px_#34d399] scale-110"
          : "bg-white/40 scale-100")
      }
      title={`Slot ${n}`}
    />
  );
}
