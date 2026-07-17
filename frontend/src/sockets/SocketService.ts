import { io, Socket } from 'socket.io-client';
import {
  ClientEvents, ServerEvents,
  type CreateRoomPayload, type JoinRoomPayload, type MakeMovePayload,
  type RoomCreatedPayload, type PlayerJoinedPayload, type GameStartedPayload,
  type BoardUpdatedPayload, type TurnChangedPayload, type ScoreUpdatedPayload,
  type GameEndedPayload, type TimerUpdatedPayload, type ErrorPayload, type PlayerLeftPayload,
  type RoomState, type GameState,
} from '@shared/events';
import {
  BingoClientEvents, BingoServerEvents,
  type BingoAddBotPayload, type BingoCreateRoomPayload, type BingoJoinRoomPayload,
  type BingoLeaveRoomPayload, type BingoRoomCreatedPayload, type BingoPlayerJoinedPayload,
  type BingoGameStartedPayload, type BingoBoardUpdatedPayload, type BingoTurnChangedPayload,
  type BingoScoreUpdatedPayload, type BingoGameEndedPayload, type BingoTimerUpdatedPayload,
  type BingoErrorPayload, type BingoRoomState, type BingoGameState, type BingoPlayerLeftPayload,
  type BingoRoomUpdatePayload, type BingoSelectNumberPayload,
} from '@shared/bingo-events';
import { SOCKET_URL } from '../config';
import { telegram } from '../telegram/TelegramService';

type EventHandler = (...args: unknown[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private handlers = new Map<string, Set<EventHandler>>();
  private latestGameStarted: GameStartedPayload | null = null;
  private latestBingoGameStarted: BingoGameStartedPayload | null = null;
  private connecting: Promise<void> | null = null;

  connect(): Promise<void> {
    if (this.socket?.connected) return Promise.resolve();
    if (this.connecting) return this.connecting;

    this.disposeSocketOnly();

    this.connecting = new Promise((resolve, reject) => {
      const initData = telegram.getInitData();
      const isDev = !initData;
      console.log('socket url',SOCKET_URL);

      this.socket = io(SOCKET_URL, {
        auth: isDev
          ? { devPlayerId: `dev_${Date.now()}` }
          : { initData },
        transports: ['websocket', 'polling'],
        forceNew: true,
        multiplex: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      const timeout = window.setTimeout(() => {
        this.connecting = null;
        this.disposeSocketOnly();
        reject(new Error('Socket connection timed out'));
      }, 8000);

      this.socket.on('connect', () => {
        window.clearTimeout(timeout);
        this.connecting = null;
        resolve();
      });
      this.socket.on('connect_error', (err) => {
        window.clearTimeout(timeout);
        this.connecting = null;
        this.disposeSocketOnly();
        reject(err);
      });

      Object.values(ServerEvents).forEach(event => {
        this.socket!.on(event, (...args: unknown[]) => {
          if (event === ServerEvents.GAME_STARTED) {
            this.latestGameStarted = args[0] as GameStartedPayload;
          }
          this.handlers.get(event)?.forEach(h => h(...args));
        });
      });
      Object.values(BingoServerEvents).forEach(event => {
        this.socket!.on(event, (...args: unknown[]) => {
          if (event === BingoServerEvents.GAME_STARTED) {
            this.latestBingoGameStarted = args[0] as BingoGameStartedPayload;
          }
          this.handlers.get(event)?.forEach(h => h(...args));
        });
      });
    });

    return this.connecting;
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

  bingoCreateRoom(data: BingoCreateRoomPayload): void {
    this.socket?.emit(BingoClientEvents.CREATE_ROOM, data);
  }

  bingoJoinRoom(data: BingoJoinRoomPayload): void {
    this.socket?.emit(BingoClientEvents.JOIN_ROOM, data);
  }

  bingoAddBot(roomCode: string): void {
    this.socket?.emit(BingoClientEvents.ADD_BOT, { roomCode } as BingoAddBotPayload);
  }

  bingoStartGame(roomCode: string): void {
    this.socket?.emit(BingoClientEvents.START_GAME, { roomCode });
  }

  bingoSelectNumber(data: BingoSelectNumberPayload): void {
    this.socket?.emit(BingoClientEvents.SELECT_NUMBER, data);
  }

  bingoLeaveRoom(roomCode: string): void {
    this.socket?.emit(BingoClientEvents.LEAVE_ROOM, { roomCode } as BingoLeaveRoomPayload);
  }

  disconnect(): void {
    this.disposeSocketOnly();
    this.handlers.clear();
    this.latestGameStarted = null;
    this.latestBingoGameStarted = null;
    this.connecting = null;
  }

  private disposeSocketOnly(): void {
    if (!this.socket) return;
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
  }

  getLatestGameStarted(roomCode?: string): GameStartedPayload | null {
    if (!this.latestGameStarted) return null;
    if (roomCode && this.latestGameStarted.gameState.roomCode !== roomCode) return null;
    return this.latestGameStarted;
  }

  clearLatestGameStarted(): void {
    this.latestGameStarted = null;
  }

  getLatestBingoGameStarted(roomCode?: string): BingoGameStartedPayload | null {
    if (!this.latestBingoGameStarted) return null;
    if (roomCode && this.latestBingoGameStarted.gameState.roomCode !== roomCode) return null;
    return this.latestBingoGameStarted;
  }

  clearLatestBingoGameStarted(): void {
    this.latestBingoGameStarted = null;
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();

export type {
  RoomCreatedPayload, PlayerJoinedPayload, GameStartedPayload,
  BoardUpdatedPayload, TurnChangedPayload, ScoreUpdatedPayload,
  GameEndedPayload, TimerUpdatedPayload, ErrorPayload, PlayerLeftPayload,
  RoomState, GameState,
  BingoRoomCreatedPayload, BingoPlayerJoinedPayload, BingoGameStartedPayload,
  BingoBoardUpdatedPayload, BingoTurnChangedPayload, BingoScoreUpdatedPayload,
  BingoGameEndedPayload, BingoTimerUpdatedPayload, BingoErrorPayload,
  BingoRoomState, BingoGameState, BingoPlayerLeftPayload, BingoRoomUpdatePayload,
};

export { ClientEvents, ServerEvents };
export { BingoClientEvents, BingoServerEvents };
