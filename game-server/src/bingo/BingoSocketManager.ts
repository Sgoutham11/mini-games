import { Server as SocketServer, Socket } from 'socket.io';
import {
  BingoAddBotPayload,
  BingoClientEvents,
  BingoCreateRoomPayload,
  BingoErrorPayload,
  BingoJoinRoomPayload,
  BingoLeaveRoomPayload,
  BingoRoomCreatedPayload,
  BingoPlayerJoinedPayload,
  BingoPlayerLeftPayload,
  BingoServerEvents,
  BingoStartGamePayload,
  BingoGameStartedPayload,
  BingoSelectNumberPayload,
  BingoBoardUpdatedPayload,
  BingoScoreUpdatedPayload,
  BingoTurnChangedPayload,
  BingoGameEndedPayload,
  BingoRoomUpdatePayload,
  BingoGameState,
  BingoPlayerInfo,
} from '../../../shared/bingo-events';
import {
  autoSelectBingoNumber,
  createBingoGameState,
  getNextBingoPlayerId,
  getScores,
  isBingoPlayerActive,
  markBingoPlayerQuit,
  resolveBingoQuitOutcome,
  selectBingoNumber,
} from '../../../shared/bingo-engine';
import { RedisService } from '../redis/RedisService';
import { BingoRoomManager } from './BingoRoomManager';
import { BingoTimerManager } from './BingoTimerManager';

export class BingoSocketManager {
  private roomManager: BingoRoomManager;
  private timerManager: BingoTimerManager;

  constructor(private io: SocketServer, private redis: RedisService) {
    this.roomManager = new BingoRoomManager(redis);
    this.timerManager = new BingoTimerManager(io, redis);
    this.timerManager.onTimerExpire(this.handleTimerExpiry.bind(this));
  }

  initialize(): void {
    this.io.on('connection', (socket: Socket) => {
      socket.on(BingoClientEvents.CREATE_ROOM, (data: BingoCreateRoomPayload) =>
        this.handleCreateRoom(socket, data));
      socket.on(BingoClientEvents.JOIN_ROOM, (data: BingoJoinRoomPayload) =>
        this.handleJoinRoom(socket, data));
      socket.on(BingoClientEvents.ADD_BOT, (data: BingoAddBotPayload) =>
        this.handleAddBot(socket, data));
      socket.on(BingoClientEvents.START_GAME, (data: BingoStartGamePayload) =>
        this.handleStartGame(socket, data));
      socket.on(BingoClientEvents.SELECT_NUMBER, (data: BingoSelectNumberPayload) =>
        this.handleSelectNumber(socket, data));
      socket.on(BingoClientEvents.LEAVE_ROOM, (data: BingoLeaveRoomPayload) =>
        this.handleLeaveRoom(socket, data));
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  private async handleCreateRoom(socket: Socket, data: BingoCreateRoomPayload): Promise<void> {
    try {
      const playerId = (socket.data as any)?.playerId || this.roomManager.generatePlayerId();
      const boardSize = ([5, 6, 7, 8].includes(data.boardSize) ? data.boardSize : 5) as 5 | 6 | 7 | 8;
      const playerCount = Math.max(2, Math.min(6, data.playerCount || 2));
      const room = await this.roomManager.createRoom(
        data.playerName || 'Player',
        playerId,
        boardSize,
        playerCount,
        data.telegramId
      );

      await this.mapSocket(socket, playerId, room.roomCode);
      socket.join(room.roomCode);
      const payload: BingoRoomCreatedPayload = { roomCode: room.roomCode, room };
      socket.emit(BingoServerEvents.ROOM_CREATED, payload);
      console.log(`[BingoRoom] Created ${room.roomCode} by ${data.playerName}`);
    } catch (error: any) {
      this.emitError(socket, 'BINGO_CREATE_FAILED', error.message);
    }
  }

  private async handleJoinRoom(socket: Socket, data: BingoJoinRoomPayload): Promise<void> {
    try {
      const playerId = (socket.data as any)?.playerId || this.roomManager.generatePlayerId();
      const roomCode = data.roomCode.toUpperCase().trim();
      const { room, player } = await this.roomManager.joinRoom(
        roomCode,
        data.playerName || 'Player',
        playerId,
        data.telegramId
      );

      await this.mapSocket(socket, playerId, roomCode);
      socket.join(roomCode);
      const payload: BingoPlayerJoinedPayload = { player, room };
      this.io.to(roomCode).emit(BingoServerEvents.PLAYER_JOINED, payload);
      this.io.to(roomCode).emit(BingoServerEvents.ROOM_UPDATE, { room } as BingoRoomUpdatePayload);
    } catch (error: any) {
      this.emitError(socket, 'BINGO_JOIN_FAILED', error.message);
    }
  }

  private async handleAddBot(socket: Socket, data: BingoAddBotPayload): Promise<void> {
    try {
      const playerId = (socket.data as any)?.playerId;
      const room = await this.roomManager.getRoom(data.roomCode);
      if (!room) throw new Error('Room not found');
      if (room.hostId !== playerId) throw new Error('Only host can add bots');

      const updatedRoom = await this.roomManager.addBot(data.roomCode);
      this.io.to(data.roomCode).emit(BingoServerEvents.ROOM_UPDATE, {
        room: updatedRoom,
      } as BingoRoomUpdatePayload);
    } catch (error: any) {
      this.emitError(socket, 'BINGO_ADD_BOT_FAILED', error.message);
    }
  }

  private async handleStartGame(socket: Socket, data: BingoStartGamePayload): Promise<void> {
    try {
      const playerId = (socket.data as any)?.playerId;
      const room = await this.roomManager.getRoom(data.roomCode);
      if (!room) throw new Error('Room not found');
      if (room.hostId !== playerId) throw new Error('Only host can start');
      if (room.players.length < 2) throw new Error('Need at least 2 players');

      const playingRoom = await this.roomManager.markPlaying(data.roomCode);
      const gameState = createBingoGameState(data.roomCode, playingRoom.boardSize, playingRoom.players);
      await this.redis.setBingoGameState(data.roomCode, gameState);

      this.io.to(data.roomCode).emit(BingoServerEvents.GAME_STARTED, {
        gameState,
      } as BingoGameStartedPayload);
      await this.timerManager.startTimer(data.roomCode, gameState.currentPlayerId);
      await this.handleBotTurnIfNeeded(data.roomCode, gameState);
      console.log(`[BingoGame] Started ${data.roomCode}`);
    } catch (error: any) {
      this.emitError(socket, 'BINGO_START_FAILED', error.message);
    }
  }

  private async handleSelectNumber(socket: Socket, data: BingoSelectNumberPayload): Promise<void> {
    try {
      const playerId = (socket.data as any)?.playerId;
      if (!playerId) throw new Error('Not authenticated');
      await this.applyMove(data.roomCode, playerId, data.selectedNumber, false);
    } catch (error: any) {
      this.emitError(socket, 'BINGO_MOVE_FAILED', error.message);
    }
  }

  private async applyMove(
    roomCode: string,
    playerId: string,
    selectedNumber: number,
    autoSelected: boolean
  ): Promise<void> {
    const gameState = await this.redis.getBingoGameState(roomCode);
    if (!gameState) throw new Error('Game not found');

    const result = selectBingoNumber(gameState, playerId, selectedNumber, autoSelected);
    if (!result.valid) throw new Error(result.error || 'Invalid move');

    this.timerManager.cancelTimer(roomCode);
    await this.redis.setBingoGameState(roomCode, gameState);

    this.io.to(roomCode).emit(BingoServerEvents.BOARD_UPDATED, {
      gameState,
      selectedNumber,
      selectedBy: result.selectedBy?.name ?? 'Player',
      changedPatterns: result.changedPatterns,
      autoSelected,
    } as BingoBoardUpdatedPayload);

    this.io.to(roomCode).emit(BingoServerEvents.SCORE_UPDATED, {
      scores: getScores(gameState),
      players: gameState.players,
    } as BingoScoreUpdatedPayload);

    if (result.gameOver) {
      await this.endGame(roomCode, gameState, 'completed', result.winnerId, result.isDraw);
      return;
    }

    this.io.to(roomCode).emit(BingoServerEvents.TURN_CHANGED, {
      currentPlayerId: gameState.currentPlayerId,
      turnNumber: gameState.turnNumber,
    } as BingoTurnChangedPayload);

    await this.timerManager.startTimer(roomCode, gameState.currentPlayerId);
    await this.handleBotTurnIfNeeded(roomCode, gameState);
  }

  private async handleLeaveRoom(socket: Socket, data: BingoLeaveRoomPayload): Promise<void> {
    try {
      const playerId = (socket.data as any)?.playerId;
      if (!playerId) return;
      socket.leave(data.roomCode);

      const gameState = await this.redis.getBingoGameState(data.roomCode);
      if (gameState) {
        await this.handlePlayerQuit(data.roomCode, playerId, 'leave');
      } else {
        const room = await this.roomManager.leaveWaitingRoom(data.roomCode, playerId);
        if (room) {
          this.io.to(data.roomCode).emit(BingoServerEvents.PLAYER_LEFT, {
            playerId,
            room,
          } as BingoPlayerLeftPayload);
          this.io.to(data.roomCode).emit(BingoServerEvents.ROOM_UPDATE, { room } as BingoRoomUpdatePayload);
        }
      }

      await this.cleanupSocket(socket, playerId);
    } catch (error: any) {
      console.error('[BingoLeave] Error:', error.message);
    }
  }

  private async handleDisconnect(socket: Socket): Promise<void> {
    try {
      const mapping = await this.redis.getSocketMapping(socket.id);
      if (!mapping || mapping.gameKind !== 'bingo') return;
      await this.handlePlayerQuit(mapping.roomCode, mapping.playerId, 'disconnect');
      await this.cleanupSocket(socket, mapping.playerId);
    } catch (error: any) {
      console.error('[BingoDisconnect] Error:', error.message);
    }
  }

  private async handlePlayerQuit(roomCode: string, playerId: string, source: 'leave' | 'disconnect'): Promise<void> {
    const gameState = await this.redis.getBingoGameState(roomCode);
    if (!gameState) return;
    const player = gameState.players.find(p => p.id === playerId);
    if (!player || player.status === 'QUIT') return;

    console.log(`[BingoQuit] Player ${playerId} quit ${roomCode} via ${source}`);
    const currentPlayerQuit = gameState.currentPlayerId === playerId;
    markBingoPlayerQuit(gameState, playerId);

    const room = await this.roomManager.getRoom(roomCode);
    if (room) {
      const roomPlayer = room.players.find(p => p.id === playerId);
      if (roomPlayer) {
        roomPlayer.status = 'QUIT';
        roomPlayer.isConnected = false;
        roomPlayer.isReady = false;
        roomPlayer.isHost = false;
      }
      if (room.hostId === playerId) {
        const nextHost = room.players.find(p => p.status !== 'QUIT' && p.isConnected);
        if (nextHost) {
          nextHost.isHost = true;
          room.hostId = nextHost.id;
        }
      }
      await this.roomManager.setRoom(room);
      this.io.to(roomCode).emit(BingoServerEvents.PLAYER_LEFT, {
        playerId,
        room,
        gameState,
      } as BingoPlayerLeftPayload);
      this.io.to(roomCode).emit(BingoServerEvents.ROOM_UPDATE, { room } as BingoRoomUpdatePayload);
    }

    const outcome = resolveBingoQuitOutcome(gameState);
    console.log(`[BingoQuit] Active player count in ${roomCode}: ${gameState.players.filter(isBingoPlayerActive).length}`);

    if (outcome.gameOver) {
      await this.redis.setBingoGameState(roomCode, gameState);
      await this.endGame(roomCode, gameState, 'player_left', outcome.winnerId, outcome.isDraw);
      return;
    }

    if (currentPlayerQuit || !isBingoPlayerActive(gameState.players.find(p => p.id === gameState.currentPlayerId))) {
      this.timerManager.cancelTimer(roomCode);
      gameState.currentPlayerId = getNextBingoPlayerId(gameState, playerId);
      gameState.turnNumber++;
      this.io.to(roomCode).emit(BingoServerEvents.TURN_CHANGED, {
        currentPlayerId: gameState.currentPlayerId,
        turnNumber: gameState.turnNumber,
      } as BingoTurnChangedPayload);
      await this.timerManager.startTimer(roomCode, gameState.currentPlayerId);
      console.log(`[BingoTurn] Current player quit; moved turn to ${gameState.currentPlayerId}`);
    }

    await this.redis.setBingoGameState(roomCode, gameState);
  }

  private async handleTimerExpiry(roomCode: string, playerId: string): Promise<void> {
    const gameState = await this.redis.getBingoGameState(roomCode);
    if (!gameState || gameState.currentPlayerId !== playerId) return;
    const available = gameState.boardSize * gameState.boardSize - gameState.selectedNumbers.length;
    if (available <= 0) return;

    const result = autoSelectBingoNumber(gameState, playerId);
    if (!result.valid || !result.selectedNumber) return;
    await this.redis.setBingoGameState(roomCode, gameState);

    this.io.to(roomCode).emit(BingoServerEvents.BOARD_UPDATED, {
      gameState,
      selectedNumber: result.selectedNumber,
      selectedBy: result.selectedBy?.name ?? 'Player',
      changedPatterns: result.changedPatterns,
      autoSelected: true,
    } as BingoBoardUpdatedPayload);
    this.io.to(roomCode).emit(BingoServerEvents.SCORE_UPDATED, {
      scores: getScores(gameState),
      players: gameState.players,
    } as BingoScoreUpdatedPayload);

    if (result.gameOver) {
      await this.endGame(roomCode, gameState, 'timeout', result.winnerId, result.isDraw);
      return;
    }

    this.io.to(roomCode).emit(BingoServerEvents.TURN_CHANGED, {
      currentPlayerId: gameState.currentPlayerId,
      turnNumber: gameState.turnNumber,
    } as BingoTurnChangedPayload);
    await this.timerManager.startTimer(roomCode, gameState.currentPlayerId);
    await this.handleBotTurnIfNeeded(roomCode, gameState);
  }

  private async handleBotTurnIfNeeded(roomCode: string, gameState: BingoGameState): Promise<void> {
    const current = gameState.players.find(player => player.id === gameState.currentPlayerId);
    if (!current?.isBot) return;
    setTimeout(async () => {
      const latest = await this.redis.getBingoGameState(roomCode);
      if (!latest || latest.currentPlayerId !== current.id) return;
      const result = autoSelectBingoNumber(latest, current.id);
      if (!result.valid || !result.selectedNumber) return;
      await this.redis.setBingoGameState(roomCode, latest);
      await this.applyMoveSnapshot(roomCode, latest, result.selectedNumber, current, result.changedPatterns, result.gameOver, result.winnerId, result.isDraw);
    }, 900);
  }

  private async applyMoveSnapshot(
    roomCode: string,
    gameState: BingoGameState,
    selectedNumber: number,
    selectedBy: BingoPlayerInfo,
    changedPatterns: Record<string, string[]>,
    gameOver: boolean,
    winnerId: string | null,
    isDraw: boolean
  ): Promise<void> {
    this.timerManager.cancelTimer(roomCode);
    this.io.to(roomCode).emit(BingoServerEvents.BOARD_UPDATED, {
      gameState,
      selectedNumber,
      selectedBy: selectedBy.name,
      changedPatterns,
      autoSelected: true,
    } as BingoBoardUpdatedPayload);
    this.io.to(roomCode).emit(BingoServerEvents.SCORE_UPDATED, {
      scores: getScores(gameState),
      players: gameState.players,
    } as BingoScoreUpdatedPayload);
    if (gameOver) {
      await this.endGame(roomCode, gameState, 'completed', winnerId, isDraw);
      return;
    }
    this.io.to(roomCode).emit(BingoServerEvents.TURN_CHANGED, {
      currentPlayerId: gameState.currentPlayerId,
      turnNumber: gameState.turnNumber,
    } as BingoTurnChangedPayload);
    await this.timerManager.startTimer(roomCode, gameState.currentPlayerId);
    await this.handleBotTurnIfNeeded(roomCode, gameState);
  }

  private async endGame(
    roomCode: string,
    gameState: BingoGameState,
    reason: 'completed' | 'player_left' | 'timeout',
    winnerId: string | null,
    isDraw: boolean
  ): Promise<void> {
    this.timerManager.cancelTimer(roomCode);
    this.io.to(roomCode).emit(BingoServerEvents.GAME_ENDED, {
      winnerId,
      players: gameState.players,
      scores: getScores(gameState),
      reason,
      isDraw,
      gameState,
    } as BingoGameEndedPayload);
    await this.redis.deleteBingoGameState(roomCode);
    await this.cleanupFinishedRoom(roomCode, gameState);
    console.log(`[BingoGame] Ended ${roomCode}. Winner: ${winnerId ?? 'DRAW'}`);
  }

  private async cleanupFinishedRoom(roomCode: string, gameState: BingoGameState): Promise<void> {
    const sockets = await this.io.in(roomCode).fetchSockets();

    for (const socket of sockets) {
      socket.leave(roomCode);
      const socketPlayerId = (socket.data as any)?.playerId as string | undefined;
      if (socketPlayerId) {
        await this.redis.deletePlayerSocketMapping(socketPlayerId);
        await this.redis.deletePlayerPresence(socketPlayerId);
      }
      await this.redis.deleteSocketMapping(socket.id);
      (socket.data as any).roomCode = undefined;
    }

    for (const player of gameState.players) {
      await this.redis.deletePlayerSocketMapping(player.id);
      await this.redis.deletePlayerPresence(player.id);
    }

    await this.redis.deleteBingoRoom(roomCode);
    await this.redis.deleteTimer(roomCode);
  }

  private async mapSocket(socket: Socket, playerId: string, roomCode: string): Promise<void> {
    await this.redis.setSocketMapping(socket.id, { playerId, roomCode, gameKind: 'bingo' });
    await this.redis.setPlayerSocketMapping(playerId, { socketId: socket.id, roomCode, gameKind: 'bingo' });
    await this.redis.setPlayerPresence(playerId, {
      roomCode,
      socketId: socket.id,
      lastSeen: Date.now(),
      gameKind: 'bingo',
    });
    (socket.data as any).playerId = playerId;
    (socket.data as any).roomCode = roomCode;
  }

  private async cleanupSocket(socket: Socket, playerId: string): Promise<void> {
    await this.redis.deleteSocketMapping(socket.id);
    await this.redis.deletePlayerSocketMapping(playerId);
    await this.redis.deletePlayerPresence(playerId);
    (socket.data as any).roomCode = undefined;
  }

  private emitError(socket: Socket, code: string, message: string): void {
    socket.emit(BingoServerEvents.ERROR, { code, message } as BingoErrorPayload);
  }
}
