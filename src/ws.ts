// src/ws.ts
// WebRTC transport for the controller.
//
// Browser <-> (WSS) Cloudflare Worker <-> (WebRTC DataChannel) Host.

type ControllerHandlers = {
  onOpen: () => void;
  onMessage: (msg: any) => void;
  onClose: () => void;
};

const SIGNALER_URL: string = (import.meta as any).env.VITE_SIGNALER_URL;
if (!SIGNALER_URL) {
  console.error(
    "[RTC] VITE_SIGNALER_URL is not defined. " +
      "Set it in webapp/.env.local as VITE_SIGNALER_URL=wss://<your-worker>/ws"
  );
}

// Single connection per tab for now.
let signalWS: WebSocket | null = null;
let pc: RTCPeerConnection | null = null;
let dc: RTCDataChannel | null = null;
let clientId: string | null = null;
let handlers: ControllerHandlers | null = null;

let connectionState: "disconnected" | "connecting" | "ready" = "disconnected";

export function isConnected(): boolean {
  return connectionState === "ready" && !!dc && dc.readyState === "open";
}

export function send(obj: unknown) {
  if (dc && dc.readyState === "open") {
    try {
      dc.send(JSON.stringify(obj));
    } catch (err) {
      console.log(err);
    }
  }
}

// Clean up all underlying resources.
// Safe to call multiple times.
export function disconnectController() {
  connectionState = "disconnected";

  if (dc) {
    try {
      dc.close();
    } catch (err) {
      console.log(err);
    }
  }
  dc = null;

  if (pc) {
    try {
      pc.close();
    } catch (err) {
      console.log(err);
    }
  }
  pc = null;

  if (signalWS) {
    try {
      if (
        signalWS.readyState === WebSocket.OPEN ||
        signalWS.readyState === WebSocket.CONNECTING
      ) {
        signalWS.close(1000, "client disconnect");
      }
    } catch (err) {
      console.log(err);
    }
  }
  signalWS = null;
  clientId = null;

  if (handlers) {
    try {
      handlers.onClose();
    } catch (err) {
      console.log(err);
    }
  }
}

// Main entry: establish signaling WS, then WebRTC PC + DataChannel.
// Resolves once the DataChannel is open and handlers.onOpen has been called.
export function connectController(h: ControllerHandlers): Promise<void> {
  // If something is already open/connecting, tear it down first.
  if (connectionState === "connecting" || connectionState === "ready") {
    disconnectController();
  }

  handlers = h;
  connectionState = "connecting";
  console.log("[RTC] using SIGNALER_URL ");

  return new Promise((resolve, reject) => {
    let settled = false;

    function safeResolve() {
      if (!settled) {
        settled = true;
        resolve();
      }
    }
    function safeReject(err: unknown) {
      if (!settled) {
        settled = true;
        reject(err);
      }
    }

    try {
      signalWS = new WebSocket(SIGNALER_URL);
    } catch (err) {
      safeReject(err);
      return;
    }

    const ws = signalWS;

    ws.onopen = () => {
      try {
        ws.send(JSON.stringify({ type: "client-hello" }));
      } catch (err) {
        console.log(err);
        safeReject(err);
      }
    };

    ws.onmessage = async (ev) => {
      let msg: any;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== "string") return;

      switch (msg.type) {
        case "client-welcome": {
          clientId = String(msg.clientId || "").trim();
          const hasHost = !!msg.hasHost;
          console.log("[RTC] client-welcome", { clientId, hasHost });
          if (!clientId) {
            safeReject(new Error("no clientId from signaler"));
            return;
          }
          // Create PC + DataChannel, then start offer.
          createPeerConnectionAndDataChannel(
            ws,
            clientId,
            safeResolve,
            safeReject
          );
          break;
        }

        case "answer": {
          if (!pc) return;
          if (!clientId || msg.clientId !== clientId) return;
          try {
            await pc.setRemoteDescription(msg.description);
          } catch (err) {
            console.error("[RTC] error applying answer", err);
          }
          break;
        }

        case "ice-candidate": {
          if (!pc) return;
          if (!clientId || msg.clientId !== clientId) return;
          try {
            await pc.addIceCandidate(msg.candidate);
          } catch (err) {
            console.error("[RTC] error adding ICE candidate", err);
          }
          break;
        }

        case "host-disconnected": {
          console.log("[RTC] host-disconnected from signaler");
          disconnectController();
          break;
        }

        case "host-registered": {
          // Optional info; nothing special to do.
          console.log("[RTC] host-registered (from signaler)");
          break;
        }

        default:
          // Other messages are not for the client or are not relevant here.
          break;
      }
    };

    ws.onclose = (ev) => {
      console.log("[RTC] signaler closed", ev.code, ev.reason);
      const wasReady = connectionState === "ready";
      disconnectController();
      if (!wasReady) {
        safeReject(new Error("signaler closed before connection became ready"));
      }
    };

    ws.onerror = (err) => {
      console.error("[RTC] signaler error", err);
      // onclose will handle reject/cleanup if needed.
    };
  });
}

function createPeerConnectionAndDataChannel(
  ws: WebSocket,
  cid: string,
  resolve: () => void,
  reject: (err: unknown) => void
) {
  // Browser-side RTCPeerConnection with host-only ICE.
  pc = new RTCPeerConnection({ iceServers: [] });

  pc.onicecandidate = (ev) => {
    if (ev.candidate && ws.readyState === WebSocket.OPEN && cid) {
      try {
        ws.send(
          JSON.stringify({
            type: "ice-candidate",
            clientId: cid,
            candidate: ev.candidate,
          })
        );
      } catch (err) {
        console.log(err);
      }
    }
  };

  pc.onconnectionstatechange = () => {
    console.log("[RTC] pc.connectionState", pc?.connectionState);
    if (!pc) return;
    if (
      pc.connectionState === "failed" ||
      pc.connectionState === "disconnected" ||
      pc.connectionState === "closed"
    ) {
      disconnectController();
    }
  };

  // We are the "offerer"; we create the DataChannel.
  const channel = pc.createDataChannel("controller");
  dc = channel;

  channel.onopen = () => {
    console.log("[RTC] datachannel open");
    connectionState = "ready";
    try {
      handlers?.onOpen();
    } catch (err) {
      console.log(err);
    }
    resolve();
  };

  channel.onclose = () => {
    console.log("[RTC] datachannel close");
    disconnectController();
  };

  channel.onerror = (err) => {
    console.error("[RTC] datachannel error", err);
  };

  channel.onmessage = (ev) => {
    let msg: any;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    try {
      handlers?.onMessage(msg);
    } catch (err) {
      console.log(err);
    }
  };

  (async () => {
    try {
      const offer = await pc!.createOffer();
      await pc!.setLocalDescription(offer);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "offer",
            clientId: cid,
            description: pc!.localDescription,
          })
        );
      }
    } catch (err) {
      console.error("[RTC] error creating/sending offer", err);
      reject(err);
    }
  })();
}
