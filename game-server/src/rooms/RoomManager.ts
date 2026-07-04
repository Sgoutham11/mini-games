/**
 * Room Manager — Handles room lifecycle (create, join, leave, cleanup)
 */

import { RoomState, PlayerInfo } from '../../../shared/events';
import { PLAYER_COLORS } from '../../../shared/enums';
import { RedisService } from '../redis/RedisService';
import crypto from 'crypto';

export class RoomManager {
  constructor(private redis: RedisService) {}

  /**
   * Generate a unique 6-character room code
   */
  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, 1, 0, O to avoid confusion
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Generate a unique player ID
   */
  generatePlayerId(): string {
    return `p_${crypto.randomBytes(6).toString('hex')}`;
  }

  /**
   * Create a new room
   */
  async createRoom(
    hostName: string,
    hostId: string,
    gridSize: number,
    maxPlayers: number,
    telegramId?: number
  ): Promise<RoomState> {
    // Generate unique room code
    let roomCode: string;
    let attempts = 0;
    do {
      roomCode = this.generateRoomCode();
      const existing = await this.redis.getRoom(roomCode);
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      throw new Error('Failed to generate unique room code');
    }

    const host: PlayerInfo = {
      id: hostId,
      name: hostName,
      telegramId,
      color: PLAYER_COLORS[0],
      isReady: true,
      isConnected: true,
      isHost: true,
    };

    const room: RoomState = {
      roomCode,
      status: 'waiting',
      gridSize,
      maxPlayers,
      players: [host],
      hostId: hostId,
      createdAt: Date.now(),
    };

    await this.redis.setRoom(roomCode, room);
    return room;
  }

  /**
   * Join an existing room
   */
  async joinRoom(
    roomCode: string,
    playerName: string,
    playerId: string,
    telegramId?: number
  ): Promise<{ room: RoomState; player: PlayerInfo }> {
    const room = await this.redis.getRoom(roomCode);

    if (!room) {
      throw new Error('Room not found');
    }

    if (room.status !== 'waiting') {
      throw new Error('Game already in progress');
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error('Room is full');
    }

    // Check if player name already taken in room
    if (room.players.some(p => p.name === playerName)) {
      playerName = `${playerName}_${room.players.length + 1}`;
    }

    const colorIndex = room.players.length % PLAYER_COLORS.length;
    const player: PlayerInfo = {
      id: playerId,
      name: playerName,
      telegramId,
      color: PLAYER_COLORS[colorIndex],
      isReady: false,
      isConnected: true,
      isHost: false,
    };

    room.players.push(player);
    await this.redis.setRoom(roomCode, room);

    return { room, player };
  }

  /**
   * Remove a player from a room
   */
  async leaveRoom(
    roomCode: string,
    playerId: string
  ): Promise<RoomState | null> {
    const room = await this.redis.getRoom(roomCode);
    if (!room) return null;

    room.players = room.players.filter(p => p.id !== playerId);

    // If room is empty, delete it
    if (room.players.length === 0) {
      await this.redis.deleteRoom(roomCode);
      await this.redis.deleteGameState(roomCode);
      return null;
    }

    // If host left, transfer host to next player
    if (room.hostId === playerId) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
    }

    await this.redis.setRoom(roomCode, room);
    return room;
  }

  /**
   * Set player ready status
   */
  async setPlayerReady(
    roomCode: string,
    playerId: string
  ): Promise<RoomState> {
    const room = await this.redis.getRoom(roomCode);
    if (!room) throw new Error('Room not found');

    const player = room.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found in room');

    player.isReady = true;
    await this.redis.setRoom(roomCode, room);
    return room;
  }

  /**
   * Check if all players are ready
   */
  async allPlayersReady(roomCode: string): Promise<boolean> {
    const room = await this.redis.getRoom(roomCode);
    if (!room) return false;
    return room.players.every(p => p.isReady);
  }

  /**
   * Get room state
   */
  async getRoom(roomCode: string): Promise<RoomState | null> {
    return this.redis.getRoom(roomCode);
  }

  /**
   * Set room status to playing
   */
  async setRoomPlaying(roomCode: string): Promise<void> {
    const room = await this.redis.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    room.status = 'playing';
    await this.redis.setRoom(roomCode, room);
  }

  /**
   * Set room status to finished
   */
  async setRoomFinished(roomCode: string): Promise<void> {
    const room = await this.redis.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    room.status = 'finished';
    await this.redis.setRoom(roomCode, room);
  }

  /**
   * Mark player as disconnected
   */
  async setPlayerDisconnected(
    roomCode: string,
    playerId: string
  ): Promise<RoomState | null> {
    const room = await this.redis.getRoom(roomCode);
    if (!room) return null;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.isConnected = false;
    }
    await this.redis.setRoom(roomCode, room);
    return room;
  }

  // deploy

  /**
   * Mark player as reconnected
   */
  async setPlayerReconnected(
    roomCode: string,
    playerId: string
  ): Promise<RoomState | null> {
    const room = await this.redis.getRoom(roomCode);
    if (!room) return null;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.isConnected = true;
    }
    await this.redis.setRoom(roomCode, room);
    return room;
  }
}
