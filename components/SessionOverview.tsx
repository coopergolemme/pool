import { Card } from "./ui/Card";

interface SessionStatsProps {
  totalGames: number;
  uniquePlayers: number;
}

export function SessionStats({ totalGames, uniquePlayers }: SessionStatsProps) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-[var(--font-display)] text-xl tracking-[0.06em] sm:text-2xl sm:tracking-[0.08em]">
          Session Overview
        </h2>
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#caa468] sm:text-xs sm:tracking-[0.3em]">
          Current
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 sm:text-xs sm:tracking-[0.3em]">
            Total Games
          </p>
          <p className="mt-3 font-[var(--font-display)] text-3xl tracking-[0.15em]">{totalGames}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 sm:text-xs sm:tracking-[0.3em]">
            Active Players
          </p>
          <p className="mt-3 font-[var(--font-display)] text-3xl tracking-[0.15em]">{uniquePlayers}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 sm:text-xs sm:tracking-[0.3em]">
            Top Format
          </p>
          <p className="mt-3 font-[var(--font-display)] text-3xl tracking-[0.15em]">8-Ball</p>
        </div>
      </div>
    </Card>
  );
}
