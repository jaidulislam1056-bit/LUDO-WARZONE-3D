import { MultiplayerRoomState, TeamColor } from '../types/game';

type MessageHandler = (msg: Record<string, any>) => void;

class MultiplayerClient {
  private ws: WebSocket | null = null;
  private handlers = new Set<MessageHandler>();
  public playerId: string;
  public isConnected = false;

  constructor() {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('lw_mp_player_id') : null;
    if (savedId) {
      this.playerId = savedId;
    } else {
      this.playerId = `cmdr_${Math.random().toString(36).slice(2, 9)}`;
      if (typeof window !== 'undefined') {
        localStorage.setItem('lw_mp_player_id', this.playerId);
      }
    }
  }

  public connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.isConnected = true;
        resolve(true);
        return;
      }

      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}/ws`;
        const socket = new WebSocket(url);
        this.ws = socket;

        const timeout = setTimeout(() => {
          if (socket.readyState !== WebSocket.OPEN) {
            resolve(false);
          }
        }, 4000);

        socket.onopen = () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.emitLocal({ type: 'ws:status', connected: true });
          resolve(true);
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(String(event.data));
            this.emitLocal(data);
          } catch (err) {
            console.error('WS parse error:', err);
          }
        };

        socket.onclose = () => {
          this.isConnected = false;
          this.emitLocal({ type: 'ws:status', connected: false });
        };

        socket.onerror = () => {
          clearTimeout(timeout);
          this.isConnected = false;
          resolve(false);
        };
      } catch {
        this.isConnected = false;
        resolve(false);
      }
    });
  }

  public subscribe(fn: MessageHandler) {
    this.handlers.add(fn);
    return () => {
      this.handlers.delete(fn);
    };
  }

  private emitLocal(msg: Record<string, any>) {
    for (const h of this.handlers) {
      h(msg);
    }
  }

  public send(payload: Record<string, any>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ ...payload, playerId: this.playerId }));
    }
  }

  public async createRoom(playerName: string, mode: string, team: TeamColor, isPublic: boolean) {
    const ok = await this.connect();
    if (!ok) return false;
    this.send({
      type: 'room:create',
      playerName,
      mode,
      team,
      isPublic,
    });
    return true;
  }

  public async joinRoom(code: string, playerName: string) {
    const ok = await this.connect();
    if (!ok) return false;
    this.send({
      type: 'room:join',
      code,
      playerName,
    });
    return true;
  }

  public async matchmakePublic(playerName: string, mode: string) {
    const ok = await this.connect();
    if (!ok) return false;
    this.send({
      type: 'room:matchmake',
      playerName,
      mode,
    });
    return true;
  }

  public setReady(ready: boolean) {
    this.send({ type: 'room:ready', ready });
  }

  public selectTeam(team: TeamColor) {
    this.send({ type: 'room:team', team });
  }

  public startRoomMatch() {
    this.send({ type: 'room:start' });
  }

  public requestAuthoritativeRoll() {
    this.send({ type: 'game:roll_dice' });
  }
}

export const multiplayerClient = new MultiplayerClient();
export type { MultiplayerRoomState };
