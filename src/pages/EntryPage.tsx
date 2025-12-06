import { useEffect, useState } from "react";

export type LayoutId = "abxy-tilt" | "abxy-dpad" | "minimal";

export function EntryScreen(props: {
  initialPin?: string;
  initialIndex?: number | "";
  onSubmit: (v: { pin: string; index?: number; layout: LayoutId }) => void;
}) {
  const [pin, setPin] = useState(props.initialPin ?? "");
  const [index, setIndex] = useState<number | "">(props.initialIndex ?? "");
  const [layout, setLayout] = useState<LayoutId>("abxy-tilt");

  useEffect(() => {
    // load last used choices
    const saved = localStorage.getItem("ctlr:entry");
    if (saved) {
      try {
        const j = JSON.parse(saved);
        if (typeof j.pin === "string") setPin(j.pin);
        if (
          j.index === "" ||
          (typeof j.index === "number" && j.index >= 1 && j.index <= 4)
        ) {
          setIndex(j.index);
        }
        if (
          j.layout === "abxy-tilt" ||
          j.layout === "abxy-dpad" ||
          j.layout === "minimal"
        ) {
          setLayout(j.layout);
        }
      } catch (err) {
        console.log(err);
      }
    }
  }, []);

  function submit() {
    if (!pin.trim()) return;
    const payload = {
      pin: pin.trim(),
      layout,
      index: typeof index === "number" ? index : undefined,
    };
    localStorage.setItem(
      "ctlr:entry",
      JSON.stringify({ pin: payload.pin, layout, index })
    );
    props.onSubmit(payload);
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white text-black">
      <div className="w-full max-w-md p-6">
        <h1 className="text-4xl font-extrabold tracking-widest text-center mb-8 bg-red">
          CONTROLLER
        </h1>

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">PIN</span>
            <input
              type="password"
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border px-3 py-3 text-lg"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">
              Controller # (1–4, optional)
            </span>
            <input
              className="mt-1 w-24 rounded-xl border px-3 py-2 text-lg"
              value={index}
              onChange={(e) => {
                const v = e.target.value.trim();
                setIndex(
                  v === ""
                    ? ""
                    : (Math.max(1, Math.min(4, Number(v))) as number)
                );
              }}
              placeholder=""
            />
          </label>

          <div>
            <div className="text-sm font-medium mb-2">Layout</div>
            <div className="grid grid-cols-3 gap-2">
              <LayoutButton
                current={layout}
                id="abxy-tilt"
                label="ABXY + Tilt"
                setLayout={setLayout}
              />
              <LayoutButton
                current={layout}
                id="abxy-dpad"
                label="ABXY + DPad"
                setLayout={setLayout}
              />
              <LayoutButton
                current={layout}
                id="minimal"
                label="Minimal"
                setLayout={setLayout}
              />
            </div>
          </div>

          <button
            className="mt-6 w-full rounded-2xl bg-red-600 text-white py-3 text-xl font-bold active:scale-95"
            onClick={submit}
          >
            ENTER
          </button>
        </div>
      </div>
    </div>
  );
}

function LayoutButton({
  current,
  id,
  label,
  setLayout,
}: {
  current: LayoutId;
  id: LayoutId;
  label: string;
  setLayout: (id: LayoutId) => void;
}) {
  const active = current === id;
  return (
    <button
      className={
        "rounded-xl border px-3 py-2 text-sm " +
        (active
          ? "border-black bg-black text-white"
          : "border-gray-300 bg-white")
      }
      onClick={() => setLayout(id)}
    >
      {label}
    </button>
  );
}
