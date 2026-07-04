/**
 * Timer Manager — Server-authoritative turn timers
 * Broadcasts countdown every second, auto-passes on expiry
 */

import { Server as SocketServer } from 'socket.io';
import { ServerEvents, TimerUpdatedPayload } from '../../../shared/events';
import { TURN_TIMER_SECONDS } from '../../../shared/enums';
import { RedisService } from '../redis/RedisService';

interface ActiveTimer {
  interval: NodeJS.Timeout;
  timeout: NodeJS.Timeout;
  playerId: string;
  startTime: number;
}

export class TimerManager {
  private activeTimers = new Map<string, ActiveTimer>();
  private onExpireCallback?: (roomCode: string, playerId: string) => void;

  constructor(
    private io: SocketServer,
    private redis: RedisService
  ) {}

  /**
   * Register callback for when timer expires
   */
  onTimerExpire(callback: (roomCode: string, playerId: string) => void): void {
    this.onExpireCallback = callback;
  }

  /**
   * Start a turn timer for a room
   */
  async startTimer(roomCode: string, playerId: string): Promise<void> {
    // Cancel any existing timer for this room
    this.cancelTimer(roomCode);

    const startTime = Date.now();
    const duration = TURN_TIMER_SECONDS;

    // Persist timer in Redis
    await this.redis.setTimer(roomCode, { playerId, startTime, duration });

    // Broadcast countdown every second
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, duration - elapsed);

      const payload: TimerUpdatedPayload = {
        remaining,
        playerId,
      };

      this.io.to(roomCode).emit(ServerEvents.TIMER_UPDATED, payload);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    // Auto-pass when timer expires
    const timeout = setTimeout(async () => {
      clearInterval(interval);
      this.activeTimers.delete(roomCode);
      await this.redis.deleteTimer(roomCode);

      // Emit final 0 timer
      this.io.to(roomCode).emit(ServerEvents.TIMER_UPDATED, {
        remaining: 0,
        playerId,
      } as TimerUpdatedPayload);

      if (this.onExpireCallback) {
        this.onExpireCallback(roomCode, playerId);
      }
    }, duration * 1000);

    this.activeTimers.set(roomCode, { interval, timeout, playerId, startTime });
  }

  /**
   * Cancel the timer for a room
   */
  cancelTimer(roomCode: string): void {
    const timer = this.activeTimers.get(roomCode);
    if (timer) {
      clearInterval(timer.interval);
      clearTimeout(timer.timeout);
      this.activeTimers.delete(roomCode);
    }
    // Fire-and-forget Redis cleanup
    this.redis.deleteTimer(roomCode).catch(() => {});
  }

  /**
   * Get remaining time for a room's timer
   */
  getRemainingTime(roomCode: string): number {
    const timer = this.activeTimers.get(roomCode);
    if (!timer) return 0;

    const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
    return Math.max(0, TURN_TIMER_SECONDS - elapsed);
  }

  /**
   * Cancel all active timers (for shutdown)
   */
  cancelAllTimers(): void {
    for (const [roomCode] of this.activeTimers) {
      this.cancelTimer(roomCode);
    }
  }
}
