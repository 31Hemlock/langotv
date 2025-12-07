// src/layouts/PS2ZoneLayout.tsx
import { useRef, useState, useCallback } from "react";
import type { IDpadDir } from "../pages/ControllerPage";
import type { BasicControllerProps } from "./PS2Layout";

type ZoneRect = {
  // normalized coordinates in [0, 1] relative to the controller surface
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type ZoneAction = {
  // face / misc buttons
  buttons?: string[];
  // single dpad direction
  dpad?: IDpadDir;
  // shoulder / trigger
  shoulder?: {
    side: "left" | "right";
    which: 1 | 2;
  };
  // optional label to paint on screen
  label?: string;
};

type Zone = {
  id: string;
  rect: ZoneRect;
  action: ZoneAction;
};

type PointerZones = Map<number, Set<string>>;

// Helper: check if normalized point lies inside normalized rect
function pointInRect(x: number, y: number, r: ZoneRect): boolean {
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}

// Helper: convert Rect -> absolute CSS percent box
function rectToStyle(r: ZoneRect): React.CSSProperties {
  const left = r.x0 * 100;
  const top = r.y0 * 100;
  const width = (r.x1 - r.x0) * 100;
  const height = (r.y1 - r.y0) * 100;

  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`,
  };
}

// This is your "map of the screen" – tweak these to taste.
// Everything here is in 0..1 percentages of the controller surface.
// I've chosen something vaguely "PS2-ish", but it's just data.
const ZONES: Zone[] = [
  // Left thumb area: dpad
  {
    id: "dpad_up",
    rect: { x0: 0.0, y0: 0.8, x1: 0.1, y1: 1 },
    action: { dpad: "up", label: "↑" },
  },
  {
    id: "dpad_down",
    rect: { x0: 0.1, y0: 0.8, x1: 0.2, y1: 1 },
    action: { dpad: "down", label: "↓" },
  },
  {
    id: "dpad_left",
    rect: { x0: 0.0, y0: 0.6, x1: 0.1, y1: 0.8 },
    action: { dpad: "left", label: "←" },
  },
  {
    id: "dpad_right",
    rect: { x0: 0.1, y0: 0.6, x1: 0.2, y1: 0.8 },

    action: { dpad: "right", label: "→" },
  },

  // Left top shoulder "bar" (L1 / L2)
  {
    id: "L1",
    rect: { x0: 0.0, y0: 0.3, x1: 0.15, y1: 0.5 },
    action: { shoulder: { side: "left", which: 1 }, label: "L1" },
  },
  {
    id: "L2",
    rect: { x0: 0.15, y0: 0.3, x1: 0.3, y1: 0.5 },
    action: { shoulder: { side: "left", which: 2 }, label: "L2" },
  },

  // Right top shoulder "bar" (R1 / R2)
  {
    id: "R1",
    rect: { x0: 0.3, y0: 0.5, x1: 0.45, y1: 0.75 },
    action: { shoulder: { side: "right", which: 1 }, label: "R1" },
  },
  {
    id: "R2",
    rect: { x0: 0.3, y0: 0.75, x1: 0.45, y1: 1 },
    action: { shoulder: { side: "right", which: 2 }, label: "R2" },
  },

  // Right-hand face buttons: X / Circle / Square / Triangle
  // big X at bottom-right-ish
  {
    id: "X",
    rect: { x0: 0.5, y0: 0.6, x1: 1, y1: 1 },
    action: { buttons: ["A"], label: "X" },
  },
  {
    id: "Circle",
    rect: { x0: 0.5, y0: 0.3, x1: 0.7, y1: 0.6 },
    action: { buttons: ["B"], label: "○" },
  },
  {
    id: "Triangle",
    rect: { x0: 0.7, y0: 0.3, x1: 0.85, y1: 0.6 },
    action: { buttons: ["Y"], label: "△" },
  },
  {
    id: "Square",
    rect: { x0: 0.85, y0: 0.3, x1: 1.0, y1: 0.6 },

    action: { buttons: ["X"], label: "□" },
  },

  // Start / Back at the center
  {
    id: "Start",
    rect: { x0: 0.43, y0: 0.08, x1: 0.57, y1: 0.2 },
    action: { buttons: ["START"], label: "START" },
  },
  {
    id: "Back",
    rect: { x0: 0.43, y0: 0.2, x1: 0.57, y1: 0.28 },
    action: { buttons: ["BACK"], label: "BACK" },
  },
];

export default function PS2ZoneLayout({
  onPress,
  pressDpad,
  pressShoulder,
}: BasicControllerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // For each pointerId, which zones has this gesture "visited"?
  const perPointerZonesRef = useRef<PointerZones>(new Map());

  // For visuals: current union of all active zones
  const [activeZoneIds, setActiveZoneIds] = useState<Set<string>>(new Set());

  const updateGlobalActive = useCallback(() => {
    const union = new Set<string>();
    for (const zones of perPointerZonesRef.current.values()) {
      for (const id of zones) {
        union.add(id);
      }
    }
    // create new Set so React sees identity change
    setActiveZoneIds(new Set(union));
  }, []);

  const fireZone = useCallback(
    (zone: Zone, down: boolean) => {
      const { buttons, dpad, shoulder } = zone.action;

      if (buttons && buttons.length) {
        for (const name of buttons) {
          onPress(name, down);
        }
      }

      if (dpad) {
        // your protocol only supports one dpad direction at a time,
        // so this is "last write wins" across zones using dpad
        pressDpad(dpad, down);
      }

      if (shoulder) {
        pressShoulder(shoulder.side, shoulder.which, down);
      }
    },
    [onPress, pressDpad, pressShoulder]
  );

  const zonesAtPoint = useCallback((xNorm: number, yNorm: number): Zone[] => {
    return ZONES.filter((z) => pointInRect(xNorm, yNorm, z.rect));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();

      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const xNorm = (e.clientX - rect.left) / rect.width;
      const yNorm = (e.clientY - rect.top) / rect.height;

      const hitZones = zonesAtPoint(xNorm, yNorm);
      if (!hitZones.length) return;

      const pid = e.pointerId;
      const perPointerZones = perPointerZonesRef.current;

      let setForPointer = perPointerZones.get(pid);
      if (!setForPointer) {
        setForPointer = new Set<string>();
        perPointerZones.set(pid, setForPointer);
      }

      // "Once touched, stays pressed until finger lifts":
      for (const z of hitZones) {
        if (!setForPointer.has(z.id)) {
          setForPointer.add(z.id);
          fireZone(z, true);
        }
      }

      updateGlobalActive();

      try {
        (e.currentTarget as HTMLDivElement).setPointerCapture(pid);
      } catch {
        // some browsers may throw; safe to ignore
      }
    },
    [zonesAtPoint, fireZone, updateGlobalActive]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const xNorm = (e.clientX - rect.left) / rect.width;
      const yNorm = (e.clientY - rect.top) / rect.height;

      const hitZones = zonesAtPoint(xNorm, yNorm);
      if (!hitZones.length) return;

      const pid = e.pointerId;
      const perPointerZones = perPointerZonesRef.current;

      let setForPointer = perPointerZones.get(pid);
      if (!setForPointer) {
        setForPointer = new Set<string>();
        perPointerZones.set(pid, setForPointer);
      }

      // Add any zones newly entered during this gesture
      let changed = false;
      for (const z of hitZones) {
        if (!setForPointer.has(z.id)) {
          setForPointer.add(z.id);
          fireZone(z, true);
          changed = true;
        }
      }

      if (changed) {
        updateGlobalActive();
      }
    },
    [zonesAtPoint, fireZone, updateGlobalActive]
  );

  const endPointer = useCallback(
    (pid: number) => {
      const perPointerZones = perPointerZonesRef.current;
      const setForPointer = perPointerZones.get(pid);
      if (!setForPointer) return;

      // Release everything this pointer ever pressed
      for (const zoneId of setForPointer) {
        const zone = ZONES.find((z) => z.id === zoneId);
        if (zone) {
          fireZone(zone, false);
        }
      }

      perPointerZones.delete(pid);
      updateGlobalActive();
    },
    [fireZone, updateGlobalActive]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      endPointer(e.pointerId);
      try {
        (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
      } catch {
        console.log(e);
      }
    },
    [endPointer]
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      endPointer(e.pointerId);
      try {
        (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
      } catch {
        console.log(e);
      }
    },
    [endPointer]
  );

  return (
    <div className="w-full h-full relative overflow-hidden select-none bg-[#17181c]">
      {/* This is the interactive surface. */}
      <div
        ref={containerRef}
        className="w-full h-full relative"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Visualize zones as colored blocks. These do NOT handle events. */}
        {ZONES.map((zone) => {
          const isActive = activeZoneIds.has(zone.id);
          return (
            <div
              key={zone.id}
              className={`absolute rounded-2xl border border-white/10 flex items-center justify-center text-lg font-semibold text-white pointer-events-none transition-all duration-75 ${
                isActive ? "bg-white/20" : "bg-white/8"
              }`}
              style={rectToStyle(zone.rect)}
            >
              {zone.action.label ?? zone.id}
            </div>
          );
        })}
      </div>

      {/* You can still add any overlay HUD (status, tilt button, etc.) here
          if you want the layout itself to show status. For now it just draws
          the zones. */}
    </div>
  );
}
