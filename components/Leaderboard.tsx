import { Card } from "./ui/Card";
import Link from "next/link";

interface LeaderboardProps {
  leaderboard: {
    player: string;
    rating: number;
    rd: number;
    wins: number;
    losses: number;
    gamesPlayed: number;
    winRate: number;
    streak: number;
  }[];
}

export function Leaderboard({ leaderboard }: LeaderboardProps) {
  return (
    <Card>
      <h3 className="font-[var(--font-display)] text-xl tracking-[0.06em] sm:text-2xl sm:tracking-[0.08em]">
        Global Leaderboard
      </h3>
      <div className="mt-6 space-y-4">
        {leaderboard.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-6 text-sm text-white/70">
            Add games to generate a leaderboard.
          </div>
        ) : (
          leaderboard.map((player, index) => (
            <Link
              key={player.player}
              href={`/profile/${encodeURIComponent(player.player)}`}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-3 hover:border-white/30 transition-colors"
            >
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/60">#{index + 1}</p>
                <div className="flex items-center gap-2">
                    <span className="text-lg font-medium text-white">
                        {player.player}
                    </span>
                    {Math.abs(player.streak) >= 3 && (
                        <div className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-bold ${player.streak > 0 ? "bg-orange-900/40 text-orange-200" : "bg-blue-900/40 text-blue-200"}`}>
                            {player.streak > 0 ? "🔥" : "❄️"} {Math.abs(player.streak)}
                        </div>
                    )}
                </div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Record {player.wins}-{player.losses}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">
                  {player.rating} • ±{player.rd}
                </p>
                <p className="text-sm text-white/70">{player.winRate}% win</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}
