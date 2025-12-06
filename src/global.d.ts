// app/src/global.d.ts
declare global {
  interface DeviceMotionEvent {
    /** iOS Safari only; not in standard lib.dom.d.ts */
    requestPermission?: () => Promise<"granted" | "denied">;
  }
}
export {};
