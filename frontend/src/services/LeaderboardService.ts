import { API_BASE } from '../config';

export type GameType = 'SOS' | 'BINGO';

export interface LeaderboardPlayer {
  rank: number;
  playerId: number;
  playerName: string;
  gameType: GameType;
  totalWins: number;
  totalLosses: number;
  totalGames: number;
  winLossRatio: number;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardPlayer[];
}

export type BestPlayersByGame = Partial<Record<GameType, LeaderboardPlayer | null>>;

export class LeaderboardService {
  static async getBestPlayersByGame(signal?: AbortSignal): Promise<BestPlayersByGame> {
    const response = await fetch(`${API_BASE}/api/leaderboard/best-by-game`, { signal });
    if (!response.ok) throw new Error(`Leaderboard failed: ${response.status}`);
    return response.json() as Promise<BestPlayersByGame>;
  }

  static async getLeaderboard(
    gameType: GameType,
    limit = 10,
    signal?: AbortSignal
  ): Promise<LeaderboardPlayer[]> {
    const path = gameType === 'BINGO' ? 'bingo' : 'sos';
    const response = await fetch(`${API_BASE}/api/leaderboard/${path}?limit=${limit}`, { signal });
    if (!response.ok) throw new Error(`Leaderboard failed: ${response.status}`);
    const body = await response.json() as LeaderboardResponse;
    return (body.leaderboard ?? []).slice(0, limit);
  }
}
