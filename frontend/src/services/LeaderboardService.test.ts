import { afterEach, describe, expect, it, vi } from 'vitest';
import { LeaderboardService, type LeaderboardPlayer } from './LeaderboardService';

const player = (rank: number): LeaderboardPlayer => ({
  rank,
  playerId: rank,
  playerName: `Player ${rank}`,
  gameType: 'SOS',
  totalWins: rank,
  totalLosses: 1,
  totalGames: rank + 1,
  winLossRatio: rank,
});

describe('LeaderboardService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches the best player by game endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ SOS: player(1), BINGO: null }),
    } as Response);

    const result = await LeaderboardService.getBestPlayersByGame();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/leaderboard/best-by-game'),
      { signal: undefined }
    );
    expect(result.SOS?.playerName).toBe('Player 1');
    expect(result.BINGO).toBeNull();
  });

  it('uses the game-specific leaderboard endpoint and caps returned players', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ leaderboard: Array.from({ length: 12 }, (_, i) => player(i + 1)) }),
    } as Response);

    const result = await LeaderboardService.getLeaderboard('BINGO', 10);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/leaderboard/bingo?limit=10'),
      { signal: undefined }
    );
    expect(result).toHaveLength(10);
  });

  it('throws on API errors without hiding the failure from the caller', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(LeaderboardService.getLeaderboard('SOS')).rejects.toThrow('Leaderboard failed: 500');
  });
});
