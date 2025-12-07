// src/layouts/S4Solo.tsx
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

export default function S4Solo({
  onPress,
  pressDpad,
  pressShoulder,
  onAxis,
}: BasicControllerProps) {
  const MAG = 1;

  return (
    <div className="flex flex-col w-full h-full relative overflow-hidden select-none">
      <div className="w-full h-full flex flex-row">
        <div className="w-[50%]">
          <div className="h-full grid grid-rows-1 grid-cols-2 mx-2 gap-2">
            <div className="min-h-0 h-full grid grid-cols-1 grid-rows-[3rem_minmax(0,1fr)_minmax(0,1fr)] gap-4 py-4 overflow-hidden">
              <Btn
                key="START"
                label="START"
                onDown={() => onPress("START", true)}
                onUp={() => onPress("START", false)}
                className="bg-[#c22223] w-full rounded-full relative font-bold text-white sm:text-[30px] overflow-hidden"
              />
              <Btn
                key="B"
                label="B"
                onDown={() => onPress("B", true)}
                onUp={() => onPress("B", false)}
                className="bg-[#04783e] w-full h-full rounded-full relative font-bold text-white text-[70px] overflow-hidden"
              />
              <Btn
                key="X"
                label="Z"
                onDown={() => onPress("X", true)}
                onUp={() => onPress("X", false)}
                className="bg-[#5a5b61] w-full h-full rounded-[80px] relative font-bold text-white text-[70px] overflow-hidden"
              />
            </div>
            <div className="grid grid-col w-full my-4 gap-2 grid-rows-[3rem_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="w-full grid grid-rows-1 grid-cols-2 gap-2 mx-auto">
                <DirBtn
                  label="L1"
                  onDown={() => pressShoulder("left", 1, true)}
                  onUp={() => pressShoulder("left", 1, false)}
                  className="bg-[#5a5b61] rounded-full text-[30px] text-white"
                />

                <DirBtn
                  label="R1"
                  onDown={() => pressShoulder("right", 1, true)}
                  onUp={() => pressShoulder("right", 1, false)}
                  className="bg-[#5a5b61] rounded-full text-[30px] text-white"
                />
              </div>

              <div className="grid grid-rows-3 w-full grid-cols-3 overflow-hidden h-full place-items-center">
                <DirBtn
                  label="↑"
                  onDown={() => onAxis({ ly: -MAG })}
                  onUp={() => onAxis({ ly: 0 })}
                  className="bg-[#eac503] col-start-2 row-start-1 aspect-square rounded-full text-[20px] text-white"
                />

                <DirBtn
                  label="←"
                  onDown={() => onAxis({ lx: -MAG })}
                  onUp={() => onAxis({ lx: 0 })}
                  className="bg-[#eac503] col-start-1 row-start-2 aspect-square rounded-full text-[20px] text-white"
                />

                <DirBtn
                  label="→"
                  onDown={() => onAxis({ lx: +MAG })}
                  onUp={() => onAxis({ lx: 0 })}
                  className="bg-[#eac503] col-start-3 row-start-2 aspect-square rounded-full text-[20px] text-white"
                />

                <DirBtn
                  label="↓"
                  onDown={() => onAxis({ ly: +MAG })}
                  onUp={() => onAxis({ ly: 0 })}
                  className="bg-[#eac503] col-start-2 row-start-3 aspect-square rounded-full text-[20px] text-white"
                />
              </div>
              <div className="grid grid-rows-3 w-full grid-cols-3 overflow-hidden h-full place-items-center">
                <DirBtn
                  label="↑"
                  onDown={() => pressDpad("up", true)}
                  onUp={() => pressDpad("up", false)}
                  className="bg-[#5a5b61] col-start-2 row-start-1 aspect-square rounded-xl text-[20px] text-white"
                />

                <DirBtn
                  label="←"
                  onDown={() => pressDpad("left", true)}
                  onUp={() => pressDpad("left", false)}
                  className="bg-[#5a5b61] col-start-1 row-start-2 aspect-square rounded-xl text-[20px] text-white"
                />

                <DirBtn
                  label="→"
                  onDown={() => pressDpad("right", true)}
                  onUp={() => pressDpad("right", false)}
                  className="bg-[#5a5b61] col-start-3 row-start-2 aspect-square rounded-xl text-[20px] text-white"
                />

                <DirBtn
                  label="↓"
                  onDown={() => pressDpad("down", true)}
                  onUp={() => pressDpad("down", false)}
                  className="bg-[#5a5b61] col-start-2 row-start-3 aspect-square rounded-xl text-[20px] text-white"
                />
              </div>
            </div>
          </div>
        </div>
        <Btn
          key="A"
          label="A"
          onDown={() => onPress("A", true)}
          onUp={() => onPress("A", false)}
          className="bg-[#0139c7] w-[50%] h-full relative text-[70px] font-bold text-white"
        />
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
