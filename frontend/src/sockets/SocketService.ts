import { io, Socket } from 'socket.io-client';
import {
  ClientEvents, ServerEvents,
  type CreateRoomPayload, type JoinRoomPayload, type MakeMovePayload,
  type RoomCreatedPayload, type PlayerJoinedPayload, type GameStartedPayload,
  type BoardUpdatedPayload, type TurnChangedPayload, type ScoreUpdatedPayload,
  type GameEndedPayload, type TimerUpdatedPayload, type ErrorPayload,
  type RoomState, type GameState,
} from '@shared/events';
import { SOCKET_URL } from '../config';
import { telegram } from '../telegram/TelegramService';

type EventHandler = (...args: unknown[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private handlers = new Map<string, Set<EventHandler>>();
  private latestGameStarted: GameStartedPayload | null = null;

  connect(): Promise<void> {
    if (this.socket?.connected) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const initData = telegram.getInitData();
      const isDev = !initData;
      console.log('socket url',SOCKET_URL);

      this.socket = io(SOCKET_URL, {
        auth: isDev
          ? { devPlayerId: `dev_${Date.now()}` }
          : { initData },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => resolve());
      this.socket.on('connect_error', (err) => reject(err));

      Object.values(ServerEvents).forEach(event => {
        this.socket!.on(event, (...args: unknown[]) => {
          if (event === ServerEvents.GAME_STARTED) {
            this.latestGameStarted = args[0] as GameStartedPayload;
          }
          this.handlers.get(event)?.forEach(h => h(...args));
        });
      });
    });
  }

  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  offAll(): void {
    this.handlers.clear();
  }

  createRoom(data: CreateRoomPayload): void {
    this.socket?.emit(ClientEvents.CREATE_ROOM, data);
  }

  joinRoom(data: JoinRoomPayload): void {
    this.socket?.emit(ClientEvents.JOIN_ROOM, data);
  }

  makeMove(data: MakeMovePayload): void {
    this.socket?.emit(ClientEvents.MAKE_MOVE, data);
  }

  playerReady(roomCode: string): void {
    this.socket?.emit(ClientEvents.PLAYER_READY, { roomCode });
  }

  leaveRoom(roomCode: string): void {
    this.socket?.emit(ClientEvents.LEAVE_ROOM, { roomCode });
  }

  reconnect(roomCode: string, playerId: string): void {
    this.socket?.emit(ClientEvents.RECONNECT, { roomCode, playerId });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket?.removeAllListeners();
    this.socket = null;
    this.handlers.clear();
    this.latestGameStarted = null;
  }

  getLatestGameStarted(roomCode?: string): GameStartedPayload | null {
    if (!this.latestGameStarted) return null;
    if (roomCode && this.latestGameStarted.gameState.roomCode !== roomCode) return null;
    return this.latestGameStarted;
  }

  clearLatestGameStarted(): void {
    this.latestGameStarted = null;
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();

export type {
  RoomCreatedPayload, PlayerJoinedPayload, GameStartedPayload,
  BoardUpdatedPayload, TurnChangedPayload, ScoreUpdatedPayload,
  GameEndedPayload, TimerUpdatedPayload, ErrorPayload,
  RoomState, GameState,
};

export { ClientEvents, ServerEvents };
