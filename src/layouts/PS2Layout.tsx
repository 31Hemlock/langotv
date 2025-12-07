// src/layouts/PS2Layout.tsx
import { type IDpadDir } from "../pages/ControllerPage";
import { useRef, useState } from "react";

export type BasicControllerProps = {
  status: string;
  slot: number | null;
  onPress: (name: string, down: boolean) => void;
  pressDpad: (dir: IDpadDir, down: boolean) => void;
  // which: 1 = L1/R1, 2 = L2/R2
  pressShoulder: (side: "left" | "right", which: 1 | 2, down: boolean) => void;
  onAxis: (patch: { lx?: number; ly?: number }) => void;
  onCalibrate: () => void;
  onToggleTilt: () => void;
};

// simple helper you can later move to a shared util
function randomChoice<T>(choices: T[]): T {
  const idx = Math.floor(Math.random() * choices.length);
  return choices[idx];
}

export default function PS2Layout({
  onPress,
  pressDpad,
  pressShoulder,
}: BasicControllerProps) {
  // random state so we can "unsend" the same thing on release

  // L / R shoulder squares: randomly L1 or L2
  const [leftShoulderChoice, setLeftShoulderChoice] = useState<1 | 2 | null>(
    null
  );
  const [rightShoulderChoice, setRightShoulderChoice] = useState<1 | 2 | null>(
    null
  );

  // Two random dpad buttons on the right under X
  const [dpadLRChoice, setDpadLRChoice] = useState<IDpadDir | null>(null);
  const [dpadUDChoice, setDpadUDChoice] = useState<IDpadDir | null>(null);

  return (
    <div className="flex flex-col w-full h-full relative overflow-hidden select-none">
      <div className="w-full h-full grid grid-cols-2 grid-rows-1 flex-row">
        {/* LEFT SIDE */}
        <div className="w-full h-full flex flex-col px-2 py-4 gap-4">
          {/* Big random L / R buttons (L1 or L2 each press) */}
          <div className="grid grid-cols-2 grid-rows-2 gap-4 relative flex-1">
            <div className="grid grid-rows-2 h-full row-span-2">
              {/* Random left/right */}
              <DirBtn
                label="↔"
                onDown={() => {
                  const choice = randomChoice<IDpadDir>(["left", "right"]);
                  setDpadLRChoice(choice);
                  pressDpad(choice, true);
                }}
                onUp={() => {
                  if (dpadLRChoice) {
                    // unsend the same randomly chosen direction
                    pressDpad(dpadLRChoice, false);
                    setDpadLRChoice(null);
                  }
                }}
                className="bg-[#5a5b61] h-full border-1 border-gray-200 text-[28px] text-white"
              />

              {/* Random up/down */}
              <DirBtn
                label="↕"
                onDown={() => {
                  const choice = randomChoice<IDpadDir>(["up", "down"]);
                  setDpadUDChoice(choice);
                  pressDpad(choice, true);
                }}
                onUp={() => {
                  if (dpadUDChoice) {
                    pressDpad(dpadUDChoice, false);
                    setDpadUDChoice(null);
                  }
                }}
                className="bg-[#5a5b61] h-full border-1 border-gray-200 text-[28px] text-white"
              />
            </div>

            {/* Dedicated R2 + square */}
            <Btn
              key="R2_SQUARE"
              label="R2 + □"
              onDown={() => {
                // R2 (right trigger) + Square (mapped here to Y)
                pressShoulder("right", 2, true);
                onPress("Y", true);
              }}
              onUp={() => {
                pressShoulder("right", 2, false);
                onPress("Y", false);
              }}
              className="bg-[#5551a3] row-span-2 w-full rounded-[18px] text-white text-[20px] font-semibold"
            />
          </div>
          {/* Spacer to push small controls to the bottom */}
          {/* <div className="flex-1" /> */}

          {/* Bottom row: small triangle, START, and real dpad */}
          <div className="grid grid-rows-[2.5rem_minmax(0,1fr)] gap-2">
            {/* small triangle + small START */}
            <div className="grid grid-cols-3 gap-2">
              <Btn
                key="TRIANGLE_SMALL"
                label="△"
                onDown={() => onPress("B", true)}
                onUp={() => onPress("B", false)}
                className="bg-[#0d9854] rounded-[12px] text-white text-[20px] font-bold"
              />
              {/* Real dpad, actually returns its face direction */}
              <div className="grid grid-rows-2 grid-cols-3 overflow-hidden h-full place-items-center">
                <DirBtn
                  label="↑"
                  onDown={() => pressDpad("up", true)}
                  onUp={() => pressDpad("up", false)}
                  className="bg-[#5a5b61] col-start-2 row-start-1  border-1 border-gray-200 text-[8px] text-white"
                />

                <DirBtn
                  label="←"
                  onDown={() => pressDpad("left", true)}
                  onUp={() => pressDpad("left", false)}
                  className="bg-[#5a5b61] col-start-1 row-start-1 row-span-2  border-1 border-gray-200 text-[8px] text-white"
                />

                <DirBtn
                  label="→"
                  onDown={() => pressDpad("right", true)}
                  onUp={() => pressDpad("right", false)}
                  className="bg-[#5a5b61] col-start-3 row-start-1 row-span-2 border-1 border-gray-200 text-[8px] text-white"
                />

                <DirBtn
                  label="↓"
                  onDown={() => pressDpad("down", true)}
                  onUp={() => pressDpad("down", false)}
                  className="bg-[#5a5b61] col-start-2 row-start-2  border-1 border-gray-200 text-[8px] text-white"
                />
              </div>
              <Btn
                key="START_SMALL"
                label="START"
                onDown={() => onPress("START", true)}
                onUp={() => onPress("START", false)}
                className="bg-[#1f2228] rounded-[12px] text-white text-[12px] tracking-[0.2em]"
              />
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="w-full h-full flex flex-col">
          {/* Big blue X: sends A + X while held, takes top half */}
          <Btn
            key="CROSS_BIG"
            label="X"
            onDown={() => {
              onPress("A", true);
              onPress("X", true);
            }}
            onUp={() => {
              onPress("A", false);
              onPress("X", false);
            }}
            className="bg-[#0139c7] flex-1 relative text-[80px] font-bold text-white rounded-l-[30px]"
          />

          {/* Under X: two random dpad buttons */}
          <div className="flex flex-row gap-2 px-2 py-2 h-[30%]">
            <DirBtn
              label="L"
              onDown={() => {
                const which = randomChoice<1 | 2>([1, 2]);
                setLeftShoulderChoice(which);
                pressShoulder("left", which, true);
              }}
              onUp={() => {
                if (leftShoulderChoice != null) {
                  pressShoulder("left", leftShoulderChoice, false);
                  setLeftShoulderChoice(null);
                }
              }}
              className="bg-[#3b3c40] rounded-[20px] text-[32px] text-white font-semibold h-24"
            />

            <DirBtn
              label="R"
              onDown={() => {
                const which = randomChoice<1 | 2>([1, 2]);
                setRightShoulderChoice(which);
                pressShoulder("right", which, true);
              }}
              onUp={() => {
                if (rightShoulderChoice != null) {
                  pressShoulder("right", rightShoulderChoice, false);
                  setRightShoulderChoice(null);
                }
              }}
              className="bg-[#3b3c40] rounded-[20px] text-[32px] text-white font-semibold h-24"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Btn({
  label,
  onDown,
  onUp,
  className = "px-4 py-3 rounded-2xl border",
}: {
  label: string;
  onDown: () => void;
  onUp: () => void;
  className?: string;
}) {
  const pid = useRef<number | null>(null);
  const [down, setDown] = useState(false);

  const pressedClasses = down ? " scale-95 ring ring-white/30" : "";

  return (
    <button
      role="button"
      aria-pressed={down}
      className={`select-none ${className}${pressedClasses}`}
      onPointerDown={(e) => {
        e.preventDefault();
        if (pid.current == null) {
          pid.current = e.pointerId;
          setDown(true);
          onDown();
        }
      }}
      onPointerUp={(e) => {
        if (pid.current === e.pointerId) {
          pid.current = null;
          setDown(false);
          onUp();
        }
      }}
      onPointerCancel={(e) => {
        if (pid.current === e.pointerId) {
          pid.current = null;
          setDown(false);
          onUp();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

function DirBtn({
  label,
  onDown,
  onUp,
  className = "grid place-items-center font-bold",
}: {
  label: string;
  onDown: () => void;
  onUp: () => void;
  className?: string;
}) {
  const pid = useRef<number | null>(null);
  const [down, setDown] = useState(false);

  const pressedClasses = down ? " scale-95 ring ring-white/20" : "";

  return (
    <button
      role="button"
      aria-pressed={down}
      className={`select-none ${className}${pressedClasses} w-full h-full`}
      onPointerDown={(e) => {
        e.preventDefault();
        if (pid.current == null) {
          pid.current = e.pointerId;
          setDown(true);
          onDown();
        }
      }}
      onPointerUp={(e) => {
        if (pid.current === e.pointerId) {
          pid.current = null;
          setDown(false);
          onUp();
        }
      }}
      onPointerCancel={(e) => {
        if (pid.current === e.pointerId) {
          pid.current = null;
          setDown(false);
          onUp();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}
