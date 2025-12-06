export type BasicControllerProps = {
  status: string;
  slot: number | null;
  onPress: (name: string, down: boolean) => void;
  onAxis: (patch: { lx?: number; ly?: number }) => void;
  onCalibrate: () => void;
  onToggleTilt: () => void;
};

export default function BasicController({
  status,
  slot,
  onPress,
  onAxis,
  onCalibrate,
  onToggleTilt,
}: BasicControllerProps) {
  return (
    <div className="min-h-screen p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">CONTROLLER</h1>
        <a className="text-sm underline" href="/admin">
          Admin
        </a>
      </div>

      <div className="text-sm opacity-70">
        WS: {status} {slot ? `• slot ${slot}` : ""}
      </div>

      {/* === Your styling canvas: customize freely with Tailwind === */}
      <div className="flex flex-wrap gap-2">
        {["A", "B", "X", "Y", "START", "BACK"].map((k) => (
          <Btn
            key={k}
            label={k}
            onDown={() => onPress(k, true)}
            onUp={() => onPress(k, false)}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <button className="px-3 py-2 rounded-xl border" onClick={onCalibrate}>
          Calibrate
        </button>
        <button className="px-3 py-2 rounded-xl border" onClick={onToggleTilt}>
          Toggle Tilt
        </button>
      </div>
    </div>
  );
}

function Btn({
  label,
  onDown,
  onUp,
}: {
  label: string;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <button
      className="px-4 py-3 rounded-2xl border active:scale-95 select-none"
      onPointerDown={(e) => {
        e.preventDefault();
        onDown();
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
    >
      {label}
    </button>
  );
}
