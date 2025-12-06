import { useEffect, useState } from "react";

type SlotInfo = {
  index: number;
  hasController: boolean;
  client: null | {
    id: string;
    deviceTag: string;
    ua: string;
    ip: string;
  };
};
type AdminState = { slots: SlotInfo[] };

export default function AdminPage() {
  const [data, setData] = useState<AdminState>({ slots: [] });
  const [loading, setLoading] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  function apiBase() {
    const proto = location.protocol;
    const host = location.hostname || "localhost";
    return `${proto}//${host}:5174`;
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase()}/admin/sessions`, {
        headers: { "Cache-Control": "no-cache" },
      });
      const j = (await res.json()) as AdminState;
      setData({ slots: j.slots.map((s) => ({ ...s })) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 1500);
    return () => clearInterval(id);
  }, []);

  async function post(path: string, body: any) {
    await fetch(`${apiBase()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify(body),
    });
    await load();
  }

  function handleDrop(to: number) {
    if (dragFrom == null) return;
    if (dragFrom === to) return;

    const fromHas =
      data.slots.find((s) => s.index === dragFrom)?.client != null;
    const toHas = data.slots.find((s) => s.index === to)?.client != null;

    if (fromHas && toHas) {
      post("/admin/swap", { a: dragFrom, b: to });
    } else {
      post("/admin/assign", { from: dragFrom, to });
    }
    setDragFrom(null);
  }

  return (
    <div className="min-h-screen p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Admin</h1>
        <a className="underline" href="/">
          Back
        </a>
      </div>

      <div className="mb-2 text-sm opacity-70 flex items-center gap-3">
        <button
          className="rounded border px-2 py-1 text-xs"
          onClick={load}
          disabled={loading}
        >
          Refresh
        </button>
        <button
          className="rounded border px-2 py-1 text-xs"
          onClick={() => post("/admin/reset", {})}
          disabled={loading}
        >
          Reset All
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2">
        {data.slots.map((s) => (
          <div
            key={s.index}
            className={
              "h-3 w-3 rounded-full " +
              (s.client != null ? "bg-green-500" : "bg-gray-300")
            }
            title={`Slot ${s.index}${s.client != null ? " (has client)" : ""}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {data.slots.map((slot) => {
          const client = slot.client;
          const label =
            client && client.deviceTag
              ? client.deviceTag
              : client
              ? `Client ${client.id.slice(0, 8)}`
              : "empty";
          const title =
            client && (client.deviceTag || client.ua)
              ? `${client.deviceTag || ""}${client.ua ? ` • ${client.ua}` : ""}`
              : "empty";

          return (
            <div
              key={slot.index}
              className="rounded-2xl border p-4"
              draggable={slot.client != null}
              onDragStart={() => setDragFrom(slot.index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(slot.index)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">Slot {slot.index}</div>
                <div
                  className={
                    "text-xs px-2 py-1 rounded " +
                    (slot.client ? "bg-green-600 text-white" : "bg-gray-200")
                  }
                  title={title}
                >
                  {slot.client ? label : "empty"}
                </div>
              </div>

              <div className="text-sm mb-3">
                Controller: {slot.hasController ? "connected" : "—"}
              </div>

              <div className="flex gap-2">
                <button
                  className="px-3 py-2 rounded-xl border"
                  onClick={() =>
                    post("/admin/disconnect", { index: slot.index })
                  }
                  disabled={slot.client == null}
                  title={
                    slot.client == null ? "no client" : "disconnect client"
                  }
                >
                  Disconnect
                </button>
                <span className="text-xs opacity-70 self-center">
                  Drag this card onto another slot to swap/assign
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
