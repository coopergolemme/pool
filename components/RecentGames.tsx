import { formatLabels } from "../lib/types";
import { type Game } from "../lib/glicko";
import Link from "next/link";
import { Skeleton } from "./ui/Skeleton";
import { motion, AnimatePresence } from "framer-motion";

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
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-6 text-sm text-white/70">
            No games yet. Add the first result to start tracking.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {games.map((game) => {
              const isP1Winner = game.winner === game.players[0];
              const history = ratingHistory?.[game.id];

              const renderPlayer = (name: string, isWinner: boolean) => {
                const stats = history?.[name];
                return (
                  <div className="flex flex-col">
                    <Link
                      href={`/profile/${encodeURIComponent(name)}`}
                      className={`${isWinner ? "font-bold text-green-400" : "font-normal text-red-400/80"
                        } hover:underline`}
                    >
                      {name}
                    </Link>
                    {stats && (
                      <span className="text-[10px] font-mono leading-none text-white/40">
                        {Math.round(stats.rating)}
                        <span className={stats.delta >= 0 ? "text-green-500/50" : "text-red-500/50"}>
                          ({stats.delta >= 0 ? "+" : ""}{Math.round(stats.delta)})
                        </span>
                      </span>
                    )}
                  </div>
                );
              };

              return (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:bg-white/10 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] text-white/40">
                        {new Date(game.createdAt).toLocaleString("en-US", {
                          timeZone: "America/New_York",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      {game.ballsRemaining !== null && (
                        <span className="ml-auto text-[10px] font-mono leading-none text-white/40">
                          by {game.ballsRemaining} ball{game.ballsRemaining !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-base sm:text-lg">
                      <div className="text-right">
                        {renderPlayer(game.players[0], isP1Winner)}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-white/30">vs</span>
                      <div className="text-left">
                        {renderPlayer(game.players[1], !isP1Winner)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
