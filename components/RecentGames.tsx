import { formatLabels } from "../lib/types";
import { type Game } from "../lib/glicko";
import Link from "next/link";

interface RecentGamesProps {
  games: Game[];
  title?: string;
  loading: boolean;
  ratingHistory?: Record<string, Record<string, { rating: number; delta: number }>>;
}

export function RecentGames({ games, title, loading, ratingHistory }: RecentGamesProps) {
  return (
    <div className="mt-1">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-[0.3em] text-white/60 sm:text-sm sm:tracking-[0.4em]">  
          {title || "Recent Games"}
        </h3>
      </div>
      <div className="mt-2 space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-6 text-sm text-white/70">
            Loading games from Supabase...
          </div>
        ) : games.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-6 text-sm text-white/70">
            No games yet. Add the first result to start tracking.
          </div>
        ) : (
          games.map((game) => {
             const isP1Winner = game.winner === game.players[0];
             const history = ratingHistory?.[game.id];
             
             const renderPlayer = (name: string, isWinner: boolean) => {
                 const stats = history?.[name];
                 return (
                    <span className="flex items-center gap-2">
                        <Link href={`/profile/${encodeURIComponent(name)}`} className={`${isWinner ? "font-bold text-green-400" : "font-normal text-red-400/80"} hover:underline`}>
                            {name}
                        </Link>
                        {stats && (
                            <span className="text-[10px] font-mono text-white/40">
                                {Math.round(stats.rating)} 
                                <span className={stats.delta >= 0 ? "text-green-500/50" : "text-red-500/50"}>
                                    ({stats.delta >= 0 ? "+" : ""}{Math.round(stats.delta)})
                                </span>
                            </span>
                        )}
                    </span>
                 );
             };

             return (
            <div
              key={game.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:bg-white/10 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex-1">
                 <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/60">
                        {formatLabels[game.format]}
                    </span>
                    <span className="text-[10px] text-white/40">
                       {new Date(game.createdAt).toLocaleString("en-US", {
                            timeZone: "America/New_York",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                       })}
                    </span>
                 </div>
                 
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base sm:text-lg">
                  {renderPlayer(game.players[0], isP1Winner)}
                  <span className="text-xs uppercase tracking-widest text-white/30">vs</span>
                  {renderPlayer(game.players[1], !isP1Winner)}
                </div>
              </div>
            </div>
          );
          })
        )}
      </div>
    </div>
  );
}
