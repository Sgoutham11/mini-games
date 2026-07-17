import crypto from 'crypto';
import { PLAYER_COLORS } from '../../../shared/enums';
import {
  BingoBoardSize,
  BingoPlayerInfo,
  BingoRoomState,
} from '../../../shared/bingo-events';
import { RedisService } from '../redis/RedisService';

export class BingoRoomManager {
  constructor(private redis: RedisService) {}

  generatePlayerId(): string {
    return `bp_${crypto.randomBytes(6).toString('hex')}`;
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async createRoom(
    hostName: string,
    hostId: string,
    boardSize: BingoBoardSize,
    maxPlayers: number,
    telegramId?: number
  ): Promise<BingoRoomState> {
    let roomCode = '';
    let attempts = 0;
    do {
      roomCode = this.generateRoomCode();
      const existing = await this.redis.getBingoRoom(roomCode);
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) throw new Error('Failed to generate unique room code');

    const host: BingoPlayerInfo = {
      id: hostId,
      name: hostName,
      telegramId,
      color: PLAYER_COLORS[0],
      status: 'WAITING',
      isBot: false,
      isReady: true,
      isConnected: true,
      isHost: true,
      score: 0,
    };

    const room: BingoRoomState = {
      roomCode,
      gameKind: 'bingo',
      status: 'waiting',
      boardSize,
      maxPlayers,
      players: [host],
      hostId,
      createdAt: Date.now(),
    };

    await this.redis.setBingoRoom(roomCode, room);
    return room;
  }

  async joinRoom(
    roomCode: string,
    playerName: string,
    playerId: string,
    telegramId?: number
  ): Promise<{ room: BingoRoomState; player: BingoPlayerInfo }> {
    const room = await this.redis.getBingoRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.status !== 'waiting') throw new Error('Game already in progress');
    if (room.players.length >= room.maxPlayers) throw new Error('Room is full');

    if (room.players.some(player => player.name === playerName)) {
      playerName = `${playerName}_${room.players.length + 1}`;
    }

    const color = PLAYER_COLORS[room.players.length % PLAYER_COLORS.length];
    const player: BingoPlayerInfo = {
      id: playerId,
      name: playerName,
      telegramId,
      color,
      status: 'WAITING',
      isBot: false,
      isReady: true,
      isConnected: true,
      isHost: false,
      score: 0,
    };

    room.players.push(player);
    await this.redis.setBingoRoom(roomCode, room);
    return { room, player };
  }

  async addBot(roomCode: string): Promise<BingoRoomState> {
    const room = await this.redis.getBingoRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.status !== 'waiting') throw new Error('Game already in progress');
    if (room.players.length >= room.maxPlayers) throw new Error('Room is full');

    const botCount = room.players.filter(player => player.isBot).length + 1;
    const player: BingoPlayerInfo = {
      id: `bot_${Date.now()}_${botCount}`,
      name: `Bot${botCount}`,
      color: PLAYER_COLORS[room.players.length % PLAYER_COLORS.length],
      status: 'WAITING',
      isBot: true,
      isReady: true,
      isConnected: true,
      isHost: false,
      score: 0,
    };

    room.players.push(player);
    await this.redis.setBingoRoom(roomCode, room);
    return room;
  }

  async getRoom(roomCode: string): Promise<BingoRoomState | null> {
    return this.redis.getBingoRoom(roomCode);
  }

  async setRoom(room: BingoRoomState): Promise<void> {
    await this.redis.setBingoRoom(room.roomCode, room);
  }

  async markPlaying(roomCode: string): Promise<BingoRoomState> {
    const room = await this.redis.getBingoRoom(roomCode);
    if (!room) throw new Error('Room not found');
    room.status = 'playing';
    room.players.forEach(player => {
      player.status = 'PLAYING';
      player.isReady = true;
      player.isConnected = true;
      player.score = 0;
      player.finishRank = undefined;
    });
    await this.redis.setBingoRoom(roomCode, room);
    return room;
  }

  async markFinished(roomCode: string): Promise<void> {
    const room = await this.redis.getBingoRoom(roomCode);
    if (!room) return;
    room.status = 'finished';
    await this.redis.setBingoRoom(roomCode, room);
  }

  async leaveWaitingRoom(roomCode: string, playerId: string): Promise<BingoRoomState | null> {
    const room = await this.redis.getBingoRoom(roomCode);
    if (!room) return null;

    room.players = room.players.filter(player => player.id !== playerId);
    if (room.players.length === 0) {
      await this.redis.deleteBingoRoom(roomCode);
      await this.redis.deleteBingoGameState(roomCode);
      return null;
    }

    if (room.hostId === playerId) {
      room.hostId = room.players[0].id;
      room.players.forEach((player, index) => { player.isHost = index === 0; });
    }

    await this.redis.setBingoRoom(roomCode, room);
    return room;
  }
}
