import Link from "next/link";
import { GlickoPlayer } from "../lib/glicko";
import { Skeleton } from "./ui/Skeleton";

interface StreakLeadersProps {
  stats: Map<string, GlickoPlayer>;
  loading?: boolean;
}

export function StreakLeaders({ stats, loading }: StreakLeadersProps) {
  // Filter for players with active winning streaks >= 3
  const leaders = Array.from(stats.entries())
    .filter(([_, player]) => player.streak >= 3)
    .sort((a, b) => b[1].streak - a[1].streak);

  if (loading) {
    return (
        <div className="mb-6">
            <h3 className="mb-3 text-xs uppercase tracking-[0.3em] text-white/60">On Fire 🔥</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="flex-shrink-0 h-16 w-32 rounded-2xl" />
                ))}
            </div>
        </div>
    );
  }

  if (leaders.length === 0) return null;

  return (
    <div className="mb-6">
       <h3 className="mb-3 text-xs uppercase tracking-[0.3em] text-white/60">On Fire 🔥</h3>
       <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
         {leaders.map(([username, player]) => (
            <Link 
                key={username} 
                href={`/profile/${username}`}
                className="flex-shrink-0 flex items-center gap-3 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 hover:bg-orange-500/20 transition-colors"
            >
                <div className="text-sm font-bold text-white">{username}</div>
                <div className="flex items-center gap-1 text-orange-400 font-bold">
                    <span>{player.streak}</span>
                    <span className="text-lg">🔥</span>
                </div>
            </Link>
         ))}
       </div>
    </div>
  );
}
