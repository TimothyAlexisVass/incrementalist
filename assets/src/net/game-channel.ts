import type { BootResult, ServerResult } from "./protocol";

type PhoenixMessage = [string | null, string | null, string, string, unknown];

const heartbeatIntervalMs = 25_000;

export class GameChannel {
  private socket: WebSocket | null = null;
  private ref = 0;
  private joinRef: string | null = null;
  private waiters = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private heartbeatId = 0;

  constructor(private readonly token: string | null) {}

  connect(): Promise<BootResult> {
    const params = new URLSearchParams({ vsn: "2.0.0" });
    if (this.token) params.set("anonymous_player_token", this.token);

    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    this.socket = new WebSocket(`${scheme}://${window.location.host}/socket/websocket?${params}`);

    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error("Socket unavailable"));

      this.socket.addEventListener("open", () => {
        this.startHeartbeat();
        this.join().then(resolve, reject);
      });
      this.socket.addEventListener("message", (event) => this.handleMessage(event));
      this.socket.addEventListener("error", () => reject(new Error("Socket error")));
      this.socket.addEventListener("close", () => this.stopHeartbeat());
    });
  }

  push(event: string, payload: Record<string, unknown> = {}): Promise<ServerResult> {
    return this.send("game", event, payload) as Promise<ServerResult>;
  }

  close() {
    this.stopHeartbeat();
    this.socket?.close();
    this.socket = null;
  }

  private join(): Promise<BootResult> {
    this.joinRef = this.nextRef();
    return this.send("game", "phx_join", {}, this.joinRef) as Promise<BootResult>;
  }

  private send(topic: string, event: string, payload: unknown, joinRef = this.joinRef): Promise<unknown> {
    const ref = this.nextRef();
    const message: PhoenixMessage = [joinRef, ref, topic, event, payload];

    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error("Channel is not connected"));
        return;
      }

      this.waiters.set(ref, { resolve, reject });
      this.socket.send(JSON.stringify(message));
    });
  }

  private handleMessage(event: MessageEvent<string>) {
    const message = JSON.parse(event.data) as PhoenixMessage;
    const [_joinRef, ref, _topic, eventName, payload] = message;

    if (eventName !== "phx_reply" || !ref) return;

    const waiter = this.waiters.get(ref);
    if (!waiter) return;

    this.waiters.delete(ref);
    const reply = payload as { status: "ok" | "error"; response: unknown };

    if (reply.status === "ok") {
      waiter.resolve(reply.response);
    } else {
      waiter.reject(new Error("Channel command failed"));
    }
  }

  private nextRef() {
    this.ref += 1;
    return String(this.ref);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatId = window.setInterval(() => {
      this.send("phoenix", "heartbeat", {}).catch(() => {});
    }, heartbeatIntervalMs);
  }

  private stopHeartbeat() {
    if (this.heartbeatId) window.clearInterval(this.heartbeatId);
    this.heartbeatId = 0;
  }
}
