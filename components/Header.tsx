import { Button } from "./ui/Button";

interface HeaderProps {
  userEmail: string | null;
  userName?: string | null;
  onSignOut: () => void;
  authLoading: boolean;
}

export function Header({ userEmail, userName, onSignOut, authLoading }: HeaderProps) {
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
      <p className="text-sm text-white/60">
        {userEmail ? `Signed in as ${userName || userEmail}` : "Use email and password to sign in or create an account."}
      </p>
        <div className="flex flex-wrap items-center gap-3">
          {userEmail ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={onSignOut}
              disabled={authLoading}
            >
              Sign Out
            </Button>
          ) : (
            <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-white/70 sm:text-xs sm:tracking-[0.3em]">
              Sign In
            </span>
          )}
        </div>
      </div>


    </header>
  );
}
