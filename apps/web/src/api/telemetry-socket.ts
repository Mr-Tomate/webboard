import type {
  ClientToServerMessage,
  ServerToClientMessage,
  StudentWorkspacePulse,
  WebSocketRole
} from '../types/telemetry.js';

export interface TelemetrySocketOptions {
  url?: string;
  role: WebSocketRole;
  classroomId?: string;
  workspaceId?: string;
  autoReconnect?: boolean;
  reconnectIntervalMs?: number;
}

export type TelemetryMessageHandler = (msg: ServerToClientMessage) => void;
export type TelemetryStatusHandler = (connected: boolean) => void;

export class TelemetryWebSocketClient {
  private socket: WebSocket | null = null;
  private options: Required<TelemetrySocketOptions>;
  private messageHandlers: Set<TelemetryMessageHandler> = new Set();
  private statusHandlers: Set<TelemetryStatusHandler> = new Set();
  private reconnectTimer: any = null;
  private isExplicitlyClosed = false;
  private isConnecting = false;

  constructor(options: TelemetrySocketOptions) {
    const defaultUrl =
      typeof window !== 'undefined'
        ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:3333/ws/telemetry`
        : 'ws://localhost:3333/ws/telemetry';

    this.options = {
      url: options.url || defaultUrl,
      role: options.role,
      classroomId: options.classroomId || 'default_classroom',
      workspaceId: options.workspaceId || '',
      autoReconnect: options.autoReconnect ?? true,
      reconnectIntervalMs: options.reconnectIntervalMs ?? 3000
    };
  }

  public connect(): void {
    if (this.socket && (this.socket.readyState === 1 /* OPEN */ || this.socket.readyState === 0 /* CONNECTING */)) {
      return;
    }

    if (this.isConnecting) return;

    this.isExplicitlyClosed = false;
    this.isConnecting = true;

    const query = new URLSearchParams({
      role: this.options.role,
      classroomId: this.options.classroomId
    });

    if (this.options.role === 'student' && this.options.workspaceId) {
      query.set('workspaceId', this.options.workspaceId);
    }

    const fullUrl = `${this.options.url}?${query.toString()}`;

    try {
      const WS = typeof WebSocket !== 'undefined' ? WebSocket : (globalThis as any).WebSocket;
      if (!WS) {
        this.isConnecting = false;
        return;
      }

      this.socket = new WS(fullUrl);

      this.socket!.onopen = () => {
        this.isConnecting = false;
        this.notifyStatus(true);
      };

      this.socket!.onmessage = (event: any) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : event.data.toString();
          const data = JSON.parse(raw) as ServerToClientMessage;
          this.notifyMessage(data);
        } catch {
          // Ignora mensagens malformadas
        }
      };

      this.socket!.onerror = () => {
        this.isConnecting = false;
      };

      this.socket!.onclose = () => {
        this.isConnecting = false;
        this.notifyStatus(false);
        this.socket = null;

        if (!this.isExplicitlyClosed && this.options.autoReconnect) {
          this.scheduleReconnect();
        }
      };
    } catch {
      this.isConnecting = false;
      this.notifyStatus(false);
      if (!this.isExplicitlyClosed && this.options.autoReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.notifyStatus(false);
  }

  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === 1; // 1 = OPEN
  }

  public send(msg: ClientToServerMessage): boolean {
    if (!this.isConnected()) {
      return false;
    }
    try {
      this.socket!.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }

  public sendPulse(pulse: StudentWorkspacePulse): boolean {
    return this.send({
      type: 'PULSE',
      payload: {
        ...pulse,
        classroomId: pulse.classroomId || this.options.classroomId
      }
    });
  }

  public sendFaultAlert(payload: {
    workspaceId: string;
    faultType: 'SHORT_CIRCUIT' | 'OVERCURRENT';
    message: string;
    failedWireId?: string;
    failedComponentId?: string;
  }): boolean {
    return this.send({
      type: 'FAULT_ALERT',
      payload
    });
  }

  public sendPedagogicalNote(payload: {
    workspaceId: string;
    author: string;
    text: string;
    targetComponentId?: string;
  }): boolean {
    return this.send({
      type: 'SEND_NOTE',
      payload
    });
  }

  public onMessage(handler: TelemetryMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  public onStatusChange(handler: TelemetryStatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  private notifyMessage(msg: ServerToClientMessage): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(msg);
      } catch {
        // Protege contra falhas nos handlers
      }
    }
  }

  private notifyStatus(connected: boolean): void {
    for (const handler of this.statusHandlers) {
      try {
        handler(connected);
      } catch {
        // Protege contra falhas nos handlers
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isExplicitlyClosed) {
        this.connect();
      }
    }, this.options.reconnectIntervalMs);
  }
}
