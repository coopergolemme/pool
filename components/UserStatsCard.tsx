import Link from "next/link";

interface UserStatsCardProps {
  stats: {
    rating: number;
    wins: number;
    losses: number;
    streak: number;
    rd: number;
  } | null;
  username: string;
}

export function UserStatsCard({ stats, username }: UserStatsCardProps) {
  if (!stats) return null;

  const totalGames = stats.wins + stats.losses;
  const winRate = totalGames > 0 ? Math.round((stats.wins / totalGames) * 100) : 0;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur sm:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white mb-2">My Stats</h2>
        <Link 
            href={`/profile/${username}`}
            className="text-xs uppercase tracking-widest text-white/50 hover:text-white transition-colors"
        >
            View My Profile →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-2xl border border-white/5 bg-black/20 p-3 text-center">
            <p className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Rating</p>
            <p className="text-xl font-bold text-white">{Math.round(stats.rating)}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-black/20 p-3 text-center">
            <p className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Win Rate</p>
            <p className="text-xl font-bold text-white">{winRate}%</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-black/20 p-3 text-center">
            <p className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Streak</p>
            <div className="flex items-center justify-center gap-1">
                <span className="text-xl font-bold text-white">{Math.abs(stats.streak)}</span>
                {Math.abs(stats.streak) >= 3 && stats.streak > 0 && (
                    <span className="text-base">🔥</span>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
