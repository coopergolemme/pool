export function Header() {
  return (
    <header className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[conic-gradient(from_120deg,_#caa468,_#f4f3ee,_#14463a,_#caa468)] text-black shadow-[0_12px_30px_rgba(12,20,18,0.6)]">
            <span className="font-[var(--font-display)] text-xl tracking-[0.2em]">DTD</span>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#caa468] sm:text-xs sm:tracking-[0.45em]">
              DTD Pool Game Tracker
            </p>
            <h1 className="font-[var(--font-display)] text-2xl tracking-[0.05em] sm:text-4xl sm:tracking-[0.08em]">
              Pool Game Tracker
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* <RulesModal /> */}
        </div>
      </div>
    </header>
  );
}
