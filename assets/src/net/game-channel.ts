import type { BootResult, CommandAckResult, ServerResult } from "./protocol";

// Phoenix's raw websocket frame is [joinRef, messageRef, topic, event, payload].
// This client uses the refs only to resolve Promises. Gameplay ordering is not
// inferred from websocket timing; the server persists its own command sequence.
type PhoenixMessage = [string | null, string | null, string, string, unknown];

export type ConnectionStatus = "connected" | "connecting" | "disconnected" | "reconnecting";

const heartbeatIntervalMs = 25_000;
const commandQueueLimit = 10;
const initialReconnectionDelayMs = 1000;
const maxReconnectionDelayMs = 30000;
const reconnectionBackoffFactor = 1.5;

export class GameChannel {
  private socket: WebSocket | null = null;
  private ref = 0;
  private joinRef: string | null = null;
  private waiters = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private heartbeatId = 0;
  private readonly commandQueue = Array<boolean>(commandQueueLimit).fill(false);
  private _status: ConnectionStatus = "disconnected";
  private reconnectionDelay = initialReconnectionDelayMs;
  private reconnectionTimeoutId = 0;

  public onStatusChange?: (status: ConnectionStatus) => void;
  public onBootResult?: (result: BootResult) => void;

  constructor(
    private readonly username: string | null,
    private readonly token: string | null,
    private readonly cachedSaveSlots: number[] = []
  ) {}

  get status() {
    return this._status;
  }

  private setStatus(newStatus: ConnectionStatus) {
    if (this._status === newStatus) return;
    this._status = newStatus;
    this.onStatusChange?.(newStatus);
  }

  connect(): Promise<BootResult> {
    if (this._status === "connecting" || this._status === "reconnecting") {
      // If already trying to connect, we don't start another attempt but return a promise
      // that might be hard to resolve correctly. For now, let's assume connect() is
      // called once at boot, and internal retries happen after that.
    }

    this.setStatus(this._status === "disconnected" ? "connecting" : "reconnecting");
    this.clearReconnectionTimeout();

    const params = new URLSearchParams({ vsn: "2.0.0" });
    if (this.token) params.set("token", this.token);
    if (this.cachedSaveSlots.length > 0) params.set("cached_save_slots", this.cachedSaveSlots.join(","));

    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    this.socket = new WebSocket(`${scheme}://${window.location.host}/socket/websocket?${params}`);

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        this.setStatus("disconnected");
        return reject(new Error("Socket unavailable"));
      }

      this.socket.addEventListener("open", () => {
        this.reconnectionDelay = initialReconnectionDelayMs;
        this.startHeartbeat();
        this.join().then((result) => {
          this.setStatus("connected");
          this.onBootResult?.(result);
          resolve(result);
        }, (error) => {
          this.setStatus("disconnected");
          reject(error);
        });
      });

      this.socket.addEventListener("message", (event) => this.handleMessage(event));

      this.socket.addEventListener("error", () => {
        if (this._status === "connecting") {
          this.setStatus("disconnected");
          reject(new Error("Socket error"));
        }
        this.scheduleReconnect();
      });

      this.socket.addEventListener("close", () => {
        this.stopHeartbeat();
        this.scheduleReconnect();
      });
    });
  }

  private scheduleReconnect() {
    if (this._status === "disconnected" || this._status === "reconnecting") {
      this.clearReconnectionTimeout();
      this.setStatus("reconnecting");
      this.reconnectionTimeoutId = window.setTimeout(() => {
        this.connect().catch(() => {
          // Errors in background reconnection are expected if server is down;
          // scheduleReconnect will be called again by the "close" or "error" listeners.
        });
        this.reconnectionDelay = Math.min(this.reconnectionDelay * reconnectionBackoffFactor, maxReconnectionDelayMs);
      }, this.reconnectionDelay);
    }
  }

  private clearReconnectionTimeout() {
    if (this.reconnectionTimeoutId) {
      window.clearTimeout(this.reconnectionTimeoutId);
      this.reconnectionTimeoutId = 0;
    }
  }

  push<TResponse extends ServerResult = ServerResult>(
    event: string,
    payload: Record<string, unknown> = {}
  ): Promise<TResponse> {
    return this.send("game", event, payload) as Promise<TResponse>;
  }

  pushCommand<TResponse extends ServerResult = ServerResult>(
    event: string,
    payload: Record<string, unknown> = {}
  ): Promise<TResponse> {
    const commandId = this.reserveCommandId();

    return this.send("game", event, { ...payload, command_id: commandId }).then(
      (response) => {
        this.trackCommandResult(response as ServerResult);
        return response as TResponse;
      },
      (error) => {
        this.forgetCommand(commandId);
        throw error;
      }
    );
  }

  async ackCommand(commandId: number): Promise<CommandAckResult> {
    const ack = (await this.send("game", "command.ack", commandId)) as CommandAckResult;
    this.forgetCommand(commandId);
    if (ack.released_result) this.trackCommandResult(ack.released_result);
    return ack;
  }

  close() {
    this.setStatus("disconnected");
    this.clearReconnectionTimeout();
    this.stopHeartbeat();
    this.socket?.close();
    this.socket = null;
  }

  private join(): Promise<BootResult> {
    this.joinRef = this.nextRef();
    // Joining the game topic is the point where authenticated identity turns
    // into a visible snapshot and optional replay result.
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

      // This map is transport bookkeeping only. It must not be used to infer
      // whether a gameplay command is current, processed, or acknowledged.
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

  private reserveCommandId() {
    const commandId = this.commandQueue.findIndex((waitingForResult) => waitingForResult === false);
    if (commandId < 0) throw new Error("Command queue is full");

    this.commandQueue[commandId] = true;
    return commandId;
  }

  private trackCommandResult(result: ServerResult) {
    if (!("command_id" in result)) return;
    if (result.command_id < 0 || result.command_id >= commandQueueLimit) return;
    this.commandQueue[result.command_id] = result.type === "command.queued";
  }

  private forgetCommand(commandId: number) {
    if (commandId < 0 || commandId >= commandQueueLimit) return;
    this.commandQueue[commandId] = false;
  }

  clearCommandQueue() {
    this.commandQueue.fill(false);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatId = window.setInterval(() => {
      // Heartbeats keep the socket alive. Gameplay recovery happens through
      // reconnect replay, not by retrying whatever was in flight here.
      this.send("phoenix", "heartbeat", {}).catch(() => {});
    }, heartbeatIntervalMs);
  }

  private stopHeartbeat() {
    if (this.heartbeatId) window.clearInterval(this.heartbeatId);
    this.heartbeatId = 0;
  }
}

