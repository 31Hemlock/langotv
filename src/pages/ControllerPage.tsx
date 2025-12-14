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
  const tiltOn = useRef(false);

  // Union-of-sources dpad state
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

  // Union-of-sources Virtual Stick state (Mapped to Left Stick)
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

  function ConnectButton({
    connect,
    disconnect,
  }: {
    connect: () => void;
    disconnect: () => void;
  }) {
    return (
      <button
        className="rounded border bg-white/80 backdrop-blur px-3 py-1 text-xs select-none"
        onClick={status !== "disconnected" ? disconnect : connect}
      >
        {status !== "disconnected" ? "Disconnect" : "Connect"}
      </button>
    );
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function connect() {
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
            setStatus(`error: ${j.error}`);
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
      },
    }).catch((err) => {
      console.error(err);
      setStatus("error: connect failed");
      setSlot(null);
      if (tiltOn.current) {
        stopTilt();
      }
      tiltOn.current = false;
    });
  }

  function disconnect() {
    disconnectController();
  }

  function press(name: string, down: boolean) {
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

  // New Function: Handles digital buttons for analog stick
  function pressStick(dir: StickDir, down: boolean) {
    const delta = down ? 1 : -1;
    const current = stickUsage.current[dir];
    const next = current + delta;
    stickUsage.current[dir] = next < 0 ? 0 : next;

    // Calculate axis values
    const u = stickUsage.current.up > 0 ? 1 : 0;
    const d = stickUsage.current.down > 0 ? 1 : 0;
    const l = stickUsage.current.left > 0 ? 1 : 0;
    const r = stickUsage.current.right > 0 ? 1 : 0;

    const y = u - d; // Up is positive Y in XInput
    const x = r - l; // Right is positive X in XInput

    // We default this to LEFT STICK (lx, ly)
    // If you ever want these buttons to drive Right stick, change to rx, ry
    send({ type: "state", lx: x, ly: y });
  }

  function pressShoulder(side: "left" | "right", which: 1 | 2, down: boolean) {
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
        setStatus((s) => (s.includes("• tilt") ? s : s + " • tilt"));
      });
    } else {
      stopTilt();
      tiltOn.current = false;
      setStatus((s) => s.replace(" • tilt", ""));
    }
  }

  return (
    <div className="w-full h-[100dvh] relative touch-none overflow-hidden">
      <div className="fixed top-1 left-0 z-20 right-0 flex items-center justify-center pointer-events-none">
        <div className="flex items-center gap-2 rounded-full bg-black/60 text-white px-3 py-1 text-xs">
          <SlotDot lit={slot === 1} n={1} />
          <SlotDot lit={slot === 2} n={2} />
          <SlotDot lit={slot === 3} n={3} />
          <SlotDot lit={slot === 4} n={4} />
        </div>
      </div>

      <div className="fixed top-2 right-2 flex gap-2 z-20">
        <FullscreenButton />
        <ConnectButton connect={connect} disconnect={disconnect} />
        <div className="flex gap-2 items-center">
          <button
            className="rounded border bg-white/80 backdrop-blur px-3 py-1 text-xs select-none"
            onClick={toggleTilt}
          >
            {tiltOn.current === true ? "Untilt" : "Tilt"}
          </button>

          <button
            className="rounded border bg-white/80 backdrop-blur px-3 py-1 text-xs select-none"
            onClick={calibrate}
          >
            Calibrate
          </button>
        </div>
      </div>

      <LayoutComponent
        status={status}
        slot={slot}
        onPress={press}
        pressDpad={pressDpad}
        pressShoulder={pressShoulder}
        pressStick={pressStick} // Passed down to layout
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
        "h-2.5 w-2.5 rounded-full " +
        (lit ? "bg-green-400 shadow-[0_0_6px_#34d399]" : "bg-white/40")
      }
      title={`Slot ${n}`}
    />
  );
}
