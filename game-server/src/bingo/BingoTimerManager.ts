import { Server as SocketServer } from 'socket.io';
import { BingoServerEvents, BingoTimerUpdatedPayload } from '../../../shared/bingo-events';
import { RedisService } from '../redis/RedisService';

interface ActiveBingoTimer {
  interval: NodeJS.Timeout;
  timeout: NodeJS.Timeout;
}

export class BingoTimerManager {
  private activeTimers = new Map<string, ActiveBingoTimer>();
  private onExpireCallback?: (roomCode: string, playerId: string) => void;
  private readonly duration = 15;

  constructor(private io: SocketServer, private redis: RedisService) {}

  onTimerExpire(callback: (roomCode: string, playerId: string) => void): void {
    this.onExpireCallback = callback;
  }

  async startTimer(roomCode: string, playerId: string): Promise<void> {
    this.cancelTimer(roomCode);
    const startTime = Date.now();
    await this.redis.setTimer(roomCode, { playerId, startTime, duration: this.duration });

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, this.duration - elapsed);
      this.io.to(roomCode).emit(BingoServerEvents.TIMER_UPDATED, {
        remaining,
        playerId,
      } as BingoTimerUpdatedPayload);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    const timeout = setTimeout(async () => {
      clearInterval(interval);
      this.activeTimers.delete(roomCode);
      await this.redis.deleteTimer(roomCode);
      this.io.to(roomCode).emit(BingoServerEvents.TIMER_UPDATED, {
        remaining: 0,
        playerId,
      } as BingoTimerUpdatedPayload);
      this.onExpireCallback?.(roomCode, playerId);
    }, this.duration * 1000);

    this.activeTimers.set(roomCode, { interval, timeout });
  }

  cancelTimer(roomCode: string): void {
    const timer = this.activeTimers.get(roomCode);
    if (timer) {
      clearInterval(timer.interval);
      clearTimeout(timer.timeout);
      this.activeTimers.delete(roomCode);
    }
    this.redis.deleteTimer(roomCode).catch(() => {});
  }

  cancelAllTimers(): void {
    for (const roomCode of this.activeTimers.keys()) this.cancelTimer(roomCode);
  }
}
