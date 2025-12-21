import { useCallback, useEffect, useState } from "react";

export default function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(
    !!document.fullscreenElement
  );

  async function goFullscreen(node: HTMLElement = document.documentElement) {
    if (!document.fullscreenElement && node.requestFullscreen) {
      await node.requestFullscreen();
    } else if (document.exitFullscreen) {
      await document.exitFullscreen();
    }
  }

  const enter = useCallback(async () => {
    await goFullscreen();
    try {
      await (screen.orientation as any)?.lock?.("landscape");
    } catch (err) {
      console.log(err);
    }
  }, []);

  const exit = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      try {
        await (screen.orientation as any)?.unlock?.();
      } catch (err) {
        console.log(err);
      }
    }
  }, []);

  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  return (
    <button
      onClick={isFullscreen ? exit : enter}
      className={`
        rounded-xl border-2 px-4 py-2 text-[10px] leading-tight font-black uppercase italic select-none transition-all duration-75
        ${
          isFullscreen
            ? "bg-slate-100 border-slate-200 text-slate-400 active:text-red-400 active:border-red-200"
            : "bg-white border-blue-600 text-blue-600 shadow-md"
        }
      `}
    >
      {isFullscreen ? "FScreen" : "Fullscreen"}
    </button>
  );
}
