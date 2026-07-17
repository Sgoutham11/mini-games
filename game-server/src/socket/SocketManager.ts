/**
 * Socket Manager — Handles all Socket.IO events and game orchestration
 */

import { Server as SocketServer, Socket } from 'socket.io';
import {
  ClientEvents, ServerEvents,
  CreateRoomPayload, JoinRoomPayload, MakeMovePayload,
  PlayerReadyPayload, LeaveRoomPayload, ReconnectPayload,
  RoomCreatedPayload, PlayerJoinedPayload, GameStartedPayload,
  BoardUpdatedPayload, TurnChangedPayload, ScoreUpdatedPayload,
  GameEndedPayload, PlayerDisconnectedPayload, PlayerReconnectedPayload,
  ErrorPayload, GameState, PlayerInfo, PlayerLeftPayload,
} from '../../../shared/events';
import { RoomManager } from '../rooms/RoomManager';
import { RedisService } from '../redis/RedisService';
import { TimerManager } from '../timer/TimerManager';
import { createBoard, placeLetter, getWinner } from '../game-engine/SOSEngine';
import { getAIMove, getAIMoveDelay } from '../ai/AIEngine';
import { AIDifficulty } from '../../../shared/enums';

export class SocketManager {
  private roomManager: RoomManager;
  private timerManager: TimerManager;

  constructor(
    private io: SocketServer,
    private redis: RedisService
  ) {
    this.roomManager = new RoomManager(redis);
    this.timerManager = new TimerManager(io, redis);

    // Register timer expiry handler
    this.timerManager.onTimerExpire(this.handleTimerExpiry.bind(this));
  }

  /**
   * Initialize socket event handlers
   */
  initialize(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`[Socket] Connected: ${socket.id}`);

      socket.on(ClientEvents.CREATE_ROOM, (data: CreateRoomPayload) =>
        this.handleCreateRoom(socket, data));

      socket.on(ClientEvents.JOIN_ROOM, (data: JoinRoomPayload) =>
        this.handleJoinRoom(socket, data));

      socket.on(ClientEvents.PLAYER_READY, (data: PlayerReadyPayload) =>
        this.handlePlayerReady(socket, data));

      socket.on(ClientEvents.START_GAME, (data: { roomCode: string }) =>
        this.handleStartGame(socket, data));

      socket.on(ClientEvents.MAKE_MOVE, (data: MakeMovePayload) =>
        this.handleMakeMove(socket, data));

      socket.on(ClientEvents.LEAVE_ROOM, (data: LeaveRoomPayload) =>
        this.handleLeaveRoom(socket, data));

      socket.on(ClientEvents.RECONNECT, (data: ReconnectPayload) =>
        this.handleReconnect(socket, data));

      socket.on('disconnect', () =>
        this.handleDisconnect(socket));
    });
  }

  // ============================================================
  // Event Handlers
  // ============================================================

  private async handleCreateRoom(socket: Socket, data: CreateRoomPayload): Promise<void> {
    try {
      const playerId = (socket.data as any)?.playerId || this.roomManager.generatePlayerId();
      const gridSize = Math.max(3, Math.min(10, data.gridSize || 6));
      const playerCount = Math.max(2, Math.min(4, data.playerCount || 2));

      const room = await this.roomManager.createRoom(
        data.playerName,
        playerId,
        gridSize,
        playerCount,
        data.telegramId
      );

      // Map socket to player
      await this.redis.setSocketMapping(socket.id, {
        playerId,
        roomCode: room.roomCode,
      });
      await this.redis.setPlayerSocketMapping(playerId, { socketId: socket.id, roomCode: room.roomCode });

      await this.redis.setPlayerPresence(playerId, {
        roomCode: room.roomCode,
        socketId: socket.id,
        lastSeen: Date.now(),
      });

      // Join Socket.IO room
      socket.join(room.roomCode);

      // Store playerId on socket for later use
      (socket.data as any).playerId = playerId;
      (socket.data as any).roomCode = room.roomCode;

      const payload: RoomCreatedPayload = { roomCode: room.roomCode, room };
      socket.emit(ServerEvents.ROOM_CREATED, payload);

      console.log(`[Room] Created: ${room.roomCode} by ${data.playerName} (${playerId})`);
    } catch (error: any) {
      this.emitError(socket, 'CREATE_ROOM_FAILED', error.message);
    }
  }

  private async handleJoinRoom(socket: Socket, data: JoinRoomPayload): Promise<void> {
    try {
      const playerId = (socket.data as any)?.playerId || this.roomManager.generatePlayerId();
      const roomCode = data.roomCode.toUpperCase().trim();

      const { room, player } = await this.roomManager.joinRoom(
        roomCode,
        data.playerName,
        playerId,
        data.telegramId
      );

      // Map socket
      await this.redis.setSocketMapping(socket.id, { playerId, roomCode });
      await this.redis.setPlayerSocketMapping(playerId, { socketId: socket.id, roomCode });
      await this.redis.setPlayerPresence(playerId, {
        roomCode,
        socketId: socket.id,
        lastSeen: Date.now(),
      });

      socket.join(roomCode);
      (socket.data as any).playerId = playerId;
      (socket.data as any).roomCode = roomCode;

      // Notify all players in room
      const payload: PlayerJoinedPayload = { player, room };
      this.io.to(roomCode).emit(ServerEvents.PLAYER_JOINED, payload);

      console.log(`[Room] ${data.playerName} joined ${roomCode}`);

      // Auto-start when room is full
      if (room.players.length >= room.maxPlayers) {
        await this.autoStartGame(roomCode);
      }
    } catch (error: any) {
      this.emitError(socket, 'JOIN_ROOM_FAILED', error.message);
    }
  }

  private async handlePlayerReady(socket: Socket, data: PlayerReadyPayload): Promise<void> {
    try {
      const playerId = (socket.data as any)?.playerId;
      if (!playerId) throw new Error('Not authenticated');

      const room = await this.roomManager.setPlayerReady(data.roomCode, playerId);
      this.io.to(data.roomCode).emit(ServerEvents.ROOM_UPDATE, { room });
    } catch (error: any) {
      this.emitError(socket, 'READY_FAILED', error.message);
    }
  }

  private async autoStartGame(roomCode: string): Promise<void> {
    const room = await this.roomManager.getRoom(roomCode);
    if (!room || room.status !== 'waiting') return;
    if (room.players.length < 2) return;

    const board = createBoard(room.gridSize);
    const scores: Record<string, number> = {};
    room.players.forEach(p => {
      scores[p.id] = 0;
      p.status = 'ACTIVE';
      p.isConnected = true;
      p.isReady = true;
    });

    const gameState: GameState = {
      roomCode,
      board,
      players: room.players,
      scores,
      currentPlayerId: room.players[0].id,
      turnNumber: 1,
      scoredLines: [],
      moveHistory: [],
      startedAt: Date.now(),
      gridSize: room.gridSize,
    };

    await this.redis.setGameState(roomCode, gameState);
    await this.roomManager.setRoomPlaying(roomCode);

    const payload: GameStartedPayload = { gameState };
    this.io.to(roomCode).emit(ServerEvents.GAME_STARTED, payload);
    await this.timerManager.startTimer(roomCode, gameState.currentPlayerId);

    console.log(`[Game] Auto-started in room ${roomCode}`);
  }

  private async handleStartGame(socket: Socket, data: { roomCode: string }): Promise<void> {
    try {
      const playerId = (socket.data as any)?.playerId;
      const room = await this.roomManager.getRoom(data.roomCode);

      if (!room) throw new Error('Room not found');
      if (room.hostId !== playerId) throw new Error('Only host can start');
      if (room.players.length < 2) throw new Error('Need at least 2 players');

      // Initialize game state
      const board = createBoard(room.gridSize);
      const scores: Record<string, number> = {};
      room.players.forEach(p => {
        scores[p.id] = 0;
        p.status = 'ACTIVE';
        p.isConnected = true;
      });

      const gameState: GameState = {
        roomCode: data.roomCode,
        board,
        players: room.players,
        scores,
        currentPlayerId: room.players[0].id,
        turnNumber: 1,
        scoredLines: [],
        moveHistory: [],
        startedAt: Date.now(),
        gridSize: room.gridSize,
      };

      await this.redis.setGameState(data.roomCode, gameState);
      await this.roomManager.setRoomPlaying(data.roomCode);

      const payload: GameStartedPayload = { gameState };
      this.io.to(data.roomCode).emit(ServerEvents.GAME_STARTED, payload);

      // Start turn timer
      await this.timerManager.startTimer(data.roomCode, gameState.currentPlayerId);

      console.log(`[Game] Started in room ${data.roomCode}`);
    } catch (error: any) {
      this.emitError(socket, 'START_FAILED', error.message);
    }
  }

  private async handleMakeMove(socket: Socket, data: MakeMovePayload): Promise<void> {
    try {
      const playerId = (socket.data as any)?.playerId;
      if (!playerId) throw new Error('Not authenticated');

      const gameState = await this.redis.getGameState(data.roomCode);
      if (!gameState) throw new Error('Game not found');
      if (!this.isPlayerActive(gameState.players.find(p => p.id === playerId))) {
        throw new Error('Player is not active');
      }

      // Validate turn
      if (gameState.currentPlayerId !== playerId) {
        throw new Error('Not your turn');
      }

      // Place letter (server-authoritative)
      const result = placeLetter(
        gameState.board,
        data.row,
        data.col,
        data.letter,
        playerId
      );

      if (!result.valid) {
        throw new Error(result.error || 'Invalid move');
      }

      // Cancel current timer
      this.timerManager.cancelTimer(data.roomCode);

      // Update scores
      gameState.scores[playerId] = (gameState.scores[playerId] || 0) + result.scoreGained;

      // Add scored lines to state
      gameState.scoredLines.push(...result.scoredLines);

      // Record move
      gameState.moveHistory.push({
        row: data.row,
        col: data.col,
        letter: data.letter,
        playerId,
        timestamp: Date.now(),
      });

      // Broadcast board update
      const boardPayload: BoardUpdatedPayload = {
        board: gameState.board,
        lastMove: gameState.moveHistory[gameState.moveHistory.length - 1],
        scoredLines: result.scoredLines,
      };
      this.io.to(data.roomCode).emit(ServerEvents.BOARD_UPDATED, boardPayload);

      // Broadcast score update
      const scorePayload: ScoreUpdatedPayload = { scores: gameState.scores };
      this.io.to(data.roomCode).emit(ServerEvents.SCORE_UPDATED, scorePayload);

      // Check game over
      if (result.gameOver) {
        await this.endGame(data.roomCode, gameState, 'board_full');
        return;
      }

      // Determine next turn
      if (!result.bonusTurn) {
        gameState.currentPlayerId = this.getNextActivePlayerId(gameState, playerId);
        gameState.turnNumber++;
      } else if (!this.isPlayerActive(gameState.players.find(p => p.id === gameState.currentPlayerId))) {
        gameState.currentPlayerId = this.getNextActivePlayerId(gameState, playerId);
        gameState.turnNumber++;
      }
      // If bonusTurn, same player keeps their turn

      // Save state
      await this.redis.setGameState(data.roomCode, gameState);

      // Broadcast turn change
      const turnPayload: TurnChangedPayload = {
        currentPlayerId: gameState.currentPlayerId,
        turnNumber: gameState.turnNumber,
      };
      this.io.to(data.roomCode).emit(ServerEvents.TURN_CHANGED, turnPayload);

      // Start new timer
      await this.timerManager.startTimer(data.roomCode, gameState.currentPlayerId);

    } catch (error: any) {
      this.emitError(socket, 'MOVE_FAILED', error.message);
    }
  }

  private async handleLeaveRoom(socket: Socket, data: LeaveRoomPayload): Promise<void> {
    try {
      const playerId = (socket.data as any)?.playerId;
      if (!playerId) return;

      socket.leave(data.roomCode);

      // Check if game is in progress
      const gameState = await this.redis.getGameState(data.roomCode);
      if (gameState) {
        await this.handlePlayerQuit(data.roomCode, playerId, 'leave');
      } else {
        const room = await this.roomManager.leaveRoom(data.roomCode, playerId);

        if (room) {
          const payload: PlayerLeftPayload = { playerId, room };
          this.io.to(data.roomCode).emit(ServerEvents.PLAYER_LEFT, payload);
        }
      }

      // Cleanup
      await this.redis.deleteSocketMapping(socket.id);
      await this.redis.deletePlayerSocketMapping(playerId);
      await this.redis.deletePlayerPresence(playerId);
      (socket.data as any).roomCode = undefined;

      console.log(`[Room] Player ${playerId} left ${data.roomCode}`);
    } catch (error: any) {
      console.error('[LeaveRoom] Error:', error.message);
    }
  }

  private async handleReconnect(socket: Socket, data: ReconnectPayload): Promise<void> {
    try {
      const presence = await this.redis.getPlayerPresence(data.playerId);
      if (!presence || presence.roomCode !== data.roomCode) {
        throw new Error('Reconnection window expired');
      }

      // Update mappings
      await this.redis.setSocketMapping(socket.id, {
        playerId: data.playerId,
        roomCode: data.roomCode,
      });
      await this.redis.setPlayerSocketMapping(data.playerId, { socketId: socket.id, roomCode: data.roomCode });

      await this.redis.setPlayerPresence(data.playerId, {
        roomCode: data.roomCode,
        socketId: socket.id,
        lastSeen: Date.now(),
      });

      // Re-join Socket.IO room
      socket.join(data.roomCode);
      (socket.data as any).playerId = data.playerId;
      (socket.data as any).roomCode = data.roomCode;

      // Mark player as reconnected
      await this.roomManager.setPlayerReconnected(data.roomCode, data.playerId);

      // Send current game state
      const gameState = await this.redis.getGameState(data.roomCode);
      if (gameState) {
        socket.emit(ServerEvents.GAME_STARTED, { gameState } as GameStartedPayload);
      }

      const room = await this.roomManager.getRoom(data.roomCode);
      if (room) {
        const payload: PlayerReconnectedPayload = {
          playerId: data.playerId,
          playerName: room.players.find(p => p.id === data.playerId)?.name || 'Unknown',
        };
        this.io.to(data.roomCode).emit(ServerEvents.PLAYER_RECONNECTED, payload);
      }

      console.log(`[Reconnect] Player ${data.playerId} reconnected to ${data.roomCode}`);
    } catch (error: any) {
      this.emitError(socket, 'RECONNECT_FAILED', error.message);
    }
  }

  private async handleDisconnect(socket: Socket): Promise<void> {
    try {
      const mapping = await this.redis.getSocketMapping(socket.id);
      if (!mapping) return;
      if (mapping.gameKind === 'bingo') return;

      const { playerId, roomCode } = mapping;

      // Mark as disconnected but keep presence for reconnection
      await this.roomManager.setPlayerDisconnected(roomCode, playerId);

      // Update presence with disconnect time
      await this.redis.setPlayerPresence(playerId, {
        roomCode,
        socketId: '',
        lastSeen: Date.now(),
      });

      await this.redis.deleteSocketMapping(socket.id);
      await this.redis.deletePlayerSocketMapping(playerId);

      const room = await this.roomManager.getRoom(roomCode);
      if (room) {
        const player = room.players.find(p => p.id === playerId);
        const payload: PlayerDisconnectedPayload = {
          playerId,
          playerName: player?.name || 'Unknown',
        };
        this.io.to(roomCode).emit(ServerEvents.PLAYER_DISCONNECTED, payload);
      }

      console.log(`[Socket] Disconnected: ${socket.id} (player: ${playerId})`);

      const gameState = await this.redis.getGameState(roomCode);
      if (gameState) {
        await this.handlePlayerQuit(roomCode, playerId, 'disconnect');
      }
    } catch (error: any) {
      console.error('[Disconnect] Error:', error.message);
    }
  }

  // ============================================================
  // Game Logic Helpers
  // ============================================================

  private async handleTimerExpiry(roomCode: string, playerId: string): Promise<void> {
    try {
      const gameState = await this.redis.getGameState(roomCode);
      if (!gameState) return;
      if (gameState.currentPlayerId !== playerId) return;

      gameState.currentPlayerId = this.getNextActivePlayerId(gameState, playerId);
      gameState.turnNumber++;

      await this.redis.setGameState(roomCode, gameState);

      const turnPayload: TurnChangedPayload = {
        currentPlayerId: gameState.currentPlayerId,
        turnNumber: gameState.turnNumber,
      };
      this.io.to(roomCode).emit(ServerEvents.TURN_CHANGED, turnPayload);

      // Start new timer for next player
      await this.timerManager.startTimer(roomCode, gameState.currentPlayerId);

      console.log(`[Timer] Expired for ${playerId} in ${roomCode}, turn passed`);
    } catch (error: any) {
      console.error('[TimerExpiry] Error:', error.message);
    }
  }

  private async endGame(
    roomCode: string,
    gameState: GameState,
    reason: 'board_full' | 'player_left' | 'timeout',
    forcedWinnerId?: string | null
  ): Promise<void> {
    this.timerManager.cancelTimer(roomCode);

    const { winnerId, isDraw } = forcedWinnerId !== undefined
      ? { winnerId: forcedWinnerId, isDraw: forcedWinnerId === null }
      : getWinner(gameState.scores);

    const payload: GameEndedPayload = {
      winnerId,
      scores: gameState.scores,
      reason,
      isDraw,
      players: gameState.players,
    };

    this.io.to(roomCode).emit(ServerEvents.GAME_ENDED, payload);
    await this.redis.deleteGameState(roomCode);
    await this.redis.deleteTimer(roomCode);
    await this.roomManager.setRoomFinished(roomCode);

    console.log(`[Game] Ended in ${roomCode}. Winner: ${winnerId || 'DRAW'}`);
  }

  private isPlayerActive(player?: PlayerInfo): boolean {
    return !!player && player.status !== 'QUIT' && player.isConnected;
  }

  private getActivePlayers(gameState: GameState): PlayerInfo[] {
    return gameState.players.filter(p => this.isPlayerActive(p));
  }

  private getNextActivePlayerId(gameState: GameState, currentPlayerId: string): string {
    const activePlayers = this.getActivePlayers(gameState);
    if (activePlayers.length === 0) return currentPlayerId;

    const startIndex = gameState.players.findIndex(p => p.id === currentPlayerId);
    for (let offset = 1; offset <= gameState.players.length; offset++) {
      const candidate = gameState.players[(startIndex + offset + gameState.players.length) % gameState.players.length];
      if (this.isPlayerActive(candidate)) return candidate.id;
      console.log(`[Turn] Skipped ${candidate?.id ?? 'unknown'} because player is QUIT/inactive`);
    }

    return activePlayers[0].id;
  }

  private syncGamePlayersFromRoom(gameState: GameState, roomPlayers: PlayerInfo[]): void {
    gameState.players = gameState.players.map(player => {
      const roomPlayer = roomPlayers.find(p => p.id === player.id);
      return roomPlayer ? { ...player, ...roomPlayer } : player;
    });
  }

  private async handlePlayerQuit(roomCode: string, playerId: string, source: 'leave' | 'disconnect'): Promise<void> {
    const gameState = await this.redis.getGameState(roomCode);
    if (!gameState) return;

    const quittingPlayer = gameState.players.find(p => p.id === playerId);
    if (!quittingPlayer || quittingPlayer.status === 'QUIT') return;

    console.log(`[Quit] Player ${playerId} quit ${roomCode} via ${source}`);
    const currentPlayerQuit = gameState.currentPlayerId === playerId;

    const room = await this.roomManager.markPlayerQuit(roomCode, playerId);
    quittingPlayer.status = 'QUIT';
    quittingPlayer.isConnected = false;
    quittingPlayer.isReady = false;
    quittingPlayer.isHost = false;
    if (room) this.syncGamePlayersFromRoom(gameState, room.players);

    const activePlayers = this.getActivePlayers(gameState);
    console.log(`[Quit] Active player count in ${roomCode}: ${activePlayers.length}`);

    if (room) {
      const payload: PlayerLeftPayload = { playerId, room, gameState };
      this.io.to(roomCode).emit(ServerEvents.PLAYER_LEFT, payload);
      this.io.to(roomCode).emit(ServerEvents.ROOM_UPDATE, { room });
    }

    if (activePlayers.length <= 1) {
      const winnerId = activePlayers[0]?.id ?? null;
      console.log(`[Quit] Winner chosen due to quit in ${roomCode}: ${winnerId || 'DRAW'}`);
      await this.redis.setGameState(roomCode, gameState);
      await this.endGame(roomCode, gameState, 'player_left', winnerId);
      return;
    }

    if (currentPlayerQuit || !this.isPlayerActive(gameState.players.find(p => p.id === gameState.currentPlayerId))) {
      console.log(`[Turn] Current player ${gameState.currentPlayerId} quit; moving turn`);
      this.timerManager.cancelTimer(roomCode);
      gameState.currentPlayerId = this.getNextActivePlayerId(gameState, playerId);
      gameState.turnNumber++;
      await this.redis.setGameState(roomCode, gameState);

      const turnPayload: TurnChangedPayload = {
        currentPlayerId: gameState.currentPlayerId,
        turnNumber: gameState.turnNumber,
      };
      this.io.to(roomCode).emit(ServerEvents.TURN_CHANGED, turnPayload);
      await this.timerManager.startTimer(roomCode, gameState.currentPlayerId);
      return;
    }

    await this.redis.setGameState(roomCode, gameState);
  }

  private emitError(socket: Socket, code: string, message: string): void {
    const payload: ErrorPayload = { code, message };
    socket.emit(ServerEvents.ERROR, payload);
  }
}
