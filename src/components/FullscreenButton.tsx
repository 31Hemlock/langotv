import { useCallback, useEffect, useState } from "react";

export default function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(
    !!document.fullscreenElement
  );

  async function goFullscreen(node: HTMLElement = document.documentElement) {
    if (!document.fullscreenElement && node.requestFullscreen) {
      await node.requestFullscreen(); // must be from a user click/tap
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

    // const el = document.documentElement;
    // if (!document.fullscreenElement && el.requestFullscreen) {
    //   await el.requestFullscreen();
    //   try {
    //     await (screen.orientation as any)?.lock?.("landscape");
    //   } catch (err) {
    //     console.log(err);
    //   }
    // }
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
      className="rounded border bg-white/80 backdrop-blur px-3 py-1 text-xs"
    >
      {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
    </button>
  );
}
