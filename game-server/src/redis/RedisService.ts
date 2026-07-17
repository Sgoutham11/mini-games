/**
 * Redis Service — Manages all Redis operations for room/game state
 */

import { createClient, RedisClientType } from 'redis';
import { RoomState, GameState } from '../../../shared/events';
import { BingoGameState, BingoRoomState } from '../../../shared/bingo-events';
import { ROOM_TTL_SECONDS, RECONNECT_WINDOW_MS } from '../../../shared/enums';

export class RedisService {
  private client: RedisClientType;
  private connected = false;

  constructor(redisUrl: string = 'redis://localhost:6379') {
    this.client = createClient({ url: redisUrl });
    this.client.on('error', (err) => console.error('[Redis] Error:', err));
    this.client.on('connect', () => console.log('[Redis] Connected'));
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
      this.connected = false;
    }
  }

  // ============================================================
  // Room State
  // ============================================================

  async setRoom(roomCode: string, room: RoomState): Promise<void> {
    await this.client.setEx(
      `room:${roomCode}`,
      ROOM_TTL_SECONDS,
      JSON.stringify(room)
    );
  }

  async setBingoRoom(roomCode: string, room: BingoRoomState): Promise<void> {
    await this.client.setEx(
      `bingo:room:${roomCode}`,
      ROOM_TTL_SECONDS,
      JSON.stringify(room)
    );
  }

  async getBingoRoom(roomCode: string): Promise<BingoRoomState | null> {
    const data = await this.client.get(`bingo:room:${roomCode}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteBingoRoom(roomCode: string): Promise<void> {
    await this.client.del(`bingo:room:${roomCode}`);
  }

  async getRoom(roomCode: string): Promise<RoomState | null> {
    const data = await this.client.get(`room:${roomCode}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteRoom(roomCode: string): Promise<void> {
    await this.client.del(`room:${roomCode}`);
  }

  async refreshRoomTTL(roomCode: string): Promise<void> {
    await this.client.expire(`room:${roomCode}`, ROOM_TTL_SECONDS);
  }

  // ============================================================
  // Game State
  // ============================================================

  async setGameState(roomCode: string, gameState: GameState): Promise<void> {
    await this.client.setEx(
      `game:${roomCode}`,
      ROOM_TTL_SECONDS,
      JSON.stringify(gameState)
    );
  }

  async setBingoGameState(roomCode: string, gameState: BingoGameState): Promise<void> {
    await this.client.setEx(
      `bingo:game:${roomCode}`,
      ROOM_TTL_SECONDS,
      JSON.stringify(gameState)
    );
  }

  async getBingoGameState(roomCode: string): Promise<BingoGameState | null> {
    const data = await this.client.get(`bingo:game:${roomCode}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteBingoGameState(roomCode: string): Promise<void> {
    await this.client.del(`bingo:game:${roomCode}`);
  }

  async getGameState(roomCode: string): Promise<GameState | null> {
    const data = await this.client.get(`game:${roomCode}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteGameState(roomCode: string): Promise<void> {
    await this.client.del(`game:${roomCode}`);
  }

  // ============================================================
  // Player Presence
  // ============================================================

  async setPlayerPresence(
    playerId: string,
    data: { roomCode: string; socketId: string; lastSeen: number; gameKind?: 'sos' | 'bingo' }
  ): Promise<void> {
    const ttlSeconds = Math.ceil(RECONNECT_WINDOW_MS / 1000);
    await this.client.setEx(
      `presence:${playerId}`,
      ttlSeconds,
      JSON.stringify(data)
    );
  }

  async getPlayerPresence(
    playerId: string
  ): Promise<{ roomCode: string; socketId: string; lastSeen: number; gameKind?: 'sos' | 'bingo' } | null> {
    const data = await this.client.get(`presence:${playerId}`);
    return data ? JSON.parse(data) : null;
  }

  async deletePlayerPresence(playerId: string): Promise<void> {
    await this.client.del(`presence:${playerId}`);
  }

  async setPlayerSocketMapping(
    playerId: string,
    data: { socketId: string; roomCode: string; gameKind?: 'sos' | 'bingo' }
  ): Promise<void> {
    await this.client.setEx(
      `socket:${playerId}`,
      ROOM_TTL_SECONDS,
      JSON.stringify(data)
    );
  }

  async getPlayerSocketMapping(
    playerId: string
  ): Promise<{ socketId: string; roomCode: string; gameKind?: 'sos' | 'bingo' } | null> {
    const data = await this.client.get(`socket:${playerId}`);
    return data ? JSON.parse(data) : null;
  }

  async deletePlayerSocketMapping(playerId: string): Promise<void> {
    await this.client.del(`socket:${playerId}`);
  }

  // ============================================================
  // Socket Mapping (by socketId for disconnect lookup)
  // ============================================================

  async setSocketMapping(
    socketId: string,
    data: { playerId: string; roomCode: string; gameKind?: 'sos' | 'bingo' }
  ): Promise<void> {
    await this.client.setEx(
      `socket:${socketId}`,
      ROOM_TTL_SECONDS,
      JSON.stringify(data)
    );
  }

  async getSocketMapping(
    socketId: string
  ): Promise<{ playerId: string; roomCode: string; gameKind?: 'sos' | 'bingo' } | null> {
    const data = await this.client.get(`socket:${socketId}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteSocketMapping(socketId: string): Promise<void> {
    await this.client.del(`socket:${socketId}`);
  }

  // ============================================================
  // Timer State
  // ============================================================

  async setTimer(
    roomCode: string,
    data: { playerId: string; startTime: number; duration: number }
  ): Promise<void> {
    await this.client.setEx(
      `timer:${roomCode}`,
      65, // slightly longer than max turn time
      JSON.stringify(data)
    );
  }

  async getTimer(
    roomCode: string
  ): Promise<{ playerId: string; startTime: number; duration: number } | null> {
    const data = await this.client.get(`timer:${roomCode}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteTimer(roomCode: string): Promise<void> {
    await this.client.del(`timer:${roomCode}`);
  }

  // ============================================================
  // Utility
  // ============================================================

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
