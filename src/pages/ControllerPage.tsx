import { useEffect, useRef, useState } from "react";
import {
  connectController,
  disconnectController,
  send,
  isConnected,
} from "../ws";
import { startTilt, stopTilt, calibrate, requestSensors } from "../tilt";
import S4Solo from "../layouts/S4Solo";
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

export default function ControllerPage() {
  const [status, setStatus] = useState("disconnected");
  const [slot, setSlot] = useState<number | null>(null);
  const tiltOn = useRef(false);

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
        className="rounded border bg-white/80 backdrop-blur px-3 py-1 text-xs"
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
      } catch {}
    })();
    return () => {
      try {
        lock?.release?.();
      } catch {}
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

  function pressDpad(dir: IDpadDir, down: boolean) {
    send({ type: "state", dpad: down ? dir : "neutral" });
  }

  function pressShoulder(side: "left" | "right", down: boolean) {
    send({
      type: "state",
      buttons:
        side === "left" ? { SHOULDER_LEFT: down } : { SHOULDER_RIGHT: down },
    });
  }

  function toggleTilt() {
    if (!isConnected()) return;

    if (!tiltOn.current) {
      requestSensors().finally(() => {
        startTilt({
          axis: "right",
          maxDeg: 10,
          deadzone: 0,
          smooth: 0.45,
          invertX: true,
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
            className="rounded border bg-white/80 backdrop-blur px-3 py-1 text-xs"
            onClick={toggleTilt}
          >
            {tiltOn.current === true ? "Untilt" : "Tilt"}
          </button>

          <button
            className="rounded border bg-white/80 backdrop-blur px-3 py-1 text-xs"
            onClick={calibrate}
          >
            Calibrate
          </button>
        </div>
      </div>

      <S4Solo
        status={status}
        slot={slot}
        onPress={press}
        pressDpad={pressDpad}
        pressShoulder={pressShoulder}
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
