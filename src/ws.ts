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

export function disconnectController() {
  connectionState = "disconnected";

  if (dc) {
    try {
      dc.onclose = null;
      dc.onerror = null;
      dc.onmessage = null;
      dc.close();
    } catch (err) {
      console.log(err);
    }
  }
  dc = null;

  if (pc) {
    try {
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.close();
    } catch (err) {
      console.log(err);
    }
  }
  pc = null;

  if (signalWS) {
    try {
      signalWS.onopen = null;
      signalWS.onmessage = null;
      signalWS.onclose = null;
      signalWS.onerror = null;
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

export function connectController(h: ControllerHandlers): Promise<void> {
  if (connectionState === "connecting" || connectionState === "ready") {
    disconnectController();
  }

  handlers = h;
  connectionState = "connecting";

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
          console.log("[RTC] host-registered (from signaler)");
          break;
        }

        default:
          break;
      }
    };

    ws.onclose = (ev) => {
      console.log("[RTC] signaler closed", ev.code, ev.reason);
      const wasReady = connectionState === "ready";
      if (!wasReady) {
        disconnectController();
        safeReject(new Error("signaler closed before connection became ready"));
      } else {
        if (signalWS === ws) {
          signalWS = null;
        }
      }
    };

    ws.onerror = (err) => {
      console.error("[RTC] signaler error", err);
    };
  });
}

function createPeerConnectionAndDataChannel(
  ws: WebSocket,
  cid: string,
  resolve: () => void,
  reject: (err: unknown) => void
) {
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
