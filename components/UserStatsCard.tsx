import Link from "next/link";

interface UserStatsCardProps {
  stats: {
    rating: number;
    wins: number;
    losses: number;
    streak: number;
    rd: number;
    nineBall?: {
      rating: number;
      wins: number;
      losses: number;
      streak: number;
      rd: number;
    };
  } | null;
  username: string;
}

export function UserStatsCard({ stats, username }: UserStatsCardProps) {
  if (!stats) return null;

  const totalGames = stats.wins + stats.losses;
  const winRate = totalGames > 0 ? Math.round((stats.wins / totalGames) * 100) : 0;
  const nineBallWins = stats.nineBall?.wins ?? 0;
  const nineBallLosses = stats.nineBall?.losses ?? 0;
  const nineBallTotalGames = nineBallWins + nineBallLosses;
  const nineBallWinRate = nineBallTotalGames > 0 ? Math.round((nineBallWins / nineBallTotalGames) * 100) : 0;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur sm:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="mb-2 text-xl font-bold text-white">My Stats</h2>
        <Link
          href={`/profile/${username}`}
          className="text-xs uppercase tracking-widest text-white/50 hover:text-white transition-colors"
        >
          View My Profile →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-2xl border border-white/5 bg-black/20 p-3 text-center">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-white/50">8-Ball</p>
          <p className="text-xl font-bold text-white">{Math.round(stats.rating)}</p>
          <p className="text-[10px] text-white/40">{winRate}% win</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-black/20 p-3 text-center">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-white/50">9-Ball</p>
          <p className="text-xl font-bold text-white">{Math.round(stats.nineBall?.rating ?? 1500)}</p>
          <p className="text-[10px] text-white/40">{nineBallWinRate}% win</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-black/20 p-3 text-center">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-white/50">8-Ball Streak</p>
          <div className="flex items-center justify-center gap-1">
            {stats.streak < 0 && <span className="text-base">❄️</span>}
            <span className="text-xl font-bold text-white">{Math.abs(stats.streak)}</span>
            {stats.streak > 0 && <span className="text-base">🔥</span>}
          </div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-black/20 p-3 text-center">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-white/50">9-Ball Streak</p>
          <div className="flex items-center justify-center gap-1">
            {(stats.nineBall?.streak ?? 0) < 0 && <span className="text-base">❄️</span>}
            <span className="text-xl font-bold text-white">{Math.abs(stats.nineBall?.streak ?? 0)}</span>
            {(stats.nineBall?.streak ?? 0) > 0 && <span className="text-base">🔥</span>}
          </div>
        </div>
        <div className="col-span-2 rounded-2xl border border-white/5 bg-black/20 p-3 text-center sm:col-span-4">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-white/50">Records</p>
          <p className="text-xs text-white/60">
            8-Ball {stats.wins}-{stats.losses} • 9-Ball {nineBallWins}-{nineBallLosses}
          </p>
        </div>
      </div>
    </div>
  );
}
