import { Button } from "./ui/Button";
import { Select } from "./ui/Select";
import { Card } from "./ui/Card";
import { Game } from "../lib/glicko";

interface GameFormProps {
  form: any;
  setForm: (form: any) => void;
  profiles: { id: string; username: string }[];
  isSignedIn: boolean;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function GameForm({ form, setForm, profiles, isSignedIn, saving, onSubmit }: GameFormProps) {
  const teamA = form.format === "8-ball-2v2" ? `${form.playerA} & ${form.playerC}` : form.playerA;
  const teamB = form.format === "8-ball-2v2" ? `${form.playerB} & ${form.playerD}` : form.playerB;
  const teamAReady =
    form.format === "8-ball-2v2" ? form.playerA.trim() && form.playerC.trim() : form.playerA.trim();
  const teamBReady =
    form.format === "8-ball-2v2" ? form.playerB.trim() && form.playerD.trim() : form.playerB.trim();

  const playerOptions = profiles.map((p) => ({ label: p.username, value: p.username }));

  const updateForm = (updates: any) => {
      setForm((prev: any) => ({ ...prev, ...updates }));
  };

  return (
    <Card className="scroll-mt-24" id="quick-add">
      <h3 className="font-[var(--font-display)] text-xl tracking-[0.06em] sm:text-2xl sm:tracking-[0.08em]">
        Quick Add
      </h3>
      <p className="mt-2 text-sm text-white/60">
        Choose a mode, enter the two players, and tap a winner.
      </p>
      {!isSignedIn && (
        <p className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-white/70">
          Sign in to save games to your account.
        </p>
      )}
      <form className="mt-4 space-y-4" onSubmit={onSubmit} data-testid="quick-add-form">
        <div className="grid gap-4">
          <div className="space-y-2 text-[10px] uppercase tracking-[0.25em] text-white/60 sm:text-xs sm:tracking-[0.3em]">
            Game Mode
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                className="w-full"
                variant={form.format === "8-ball" ? "primary" : "outline"}
                onClick={() => updateForm({ format: "8-ball" })}
                disabled={!isSignedIn || saving}
              >
                8-Ball
              </Button>
              <Button
                type="button"
                className="w-full"
                variant={form.format === "8-ball-2v2" ? "primary" : "outline"}
                onClick={() => updateForm({ format: "8-ball-2v2" })}
                disabled={!isSignedIn || saving}
              >
                2v2 8-Ball
              </Button>
            </div>
            <p className="text-[11px] normal-case tracking-normal text-white/50">
              Single game only (no races).
            </p>
          </div>

          <Select
            label={form.format === "8-ball-2v2" ? "Team A • Player 1" : "Player 1"}
            value={form.playerA}
            onChange={(e) => updateForm({ playerA: e.target.value })}
            options={playerOptions}
            disabled={!isSignedIn || saving}
          />
          
          <Select
            label={form.format === "8-ball-2v2" ? "Team B • Player 1" : "Player 2"}
            value={form.playerB}
            onChange={(e) => updateForm({ playerB: e.target.value })}
            options={playerOptions}
            disabled={!isSignedIn || saving}
          />

          {form.format === "8-ball-2v2" && (
            <>
              <Select
                label="Team A • Player 2"
                value={form.playerC}
                onChange={(e) => updateForm({ playerC: e.target.value })}
                options={playerOptions}
                disabled={!isSignedIn || saving}
              />
              <Select
                label="Team B • Player 2"
                value={form.playerD}
                onChange={(e) => updateForm({ playerD: e.target.value })}
                options={playerOptions}
                disabled={!isSignedIn || saving}
              />
            </>
          )}

          <div className="space-y-2 text-[10px] uppercase tracking-[0.25em] text-white/60 sm:text-xs sm:tracking-[0.3em]">
            Winner
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                className="w-full"
                 variant={form.winner === teamA ? "primary" : "outline"}
                onClick={() => updateForm({ winner: teamA })}
                disabled={!isSignedIn || saving || !teamAReady}
              >
                {form.format === "8-ball-2v2" ? "Team A" : "Player 1"} Wins
              </Button>
              <Button
                type="button"
                className="w-full"
                variant={form.winner === teamB ? "primary" : "outline"}
                onClick={() => updateForm({ winner: teamB })}
                disabled={!isSignedIn || saving || !teamBReady}
              >
                {form.format === "8-ball-2v2" ? "Team B" : "Player 2"} Wins
              </Button>
            </div>
          </div>


          <div className="space-y-2 text-[10px] uppercase tracking-[0.25em] text-white/60 sm:text-xs sm:tracking-[0.3em]">
            Won By (Balls Remaining)
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                className="h-12 w-12 rounded-xl p-0 text-xl font-bold"
                onClick={() => {
                  const current = parseInt(form.ballsRemaining) || 0;
                  if (current > 0) updateForm({ ballsRemaining: (current - 1).toString() });
                }}
                disabled={!isSignedIn || saving}
              >
                -
              </Button>
              
              <div className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3 text-center">
                <span className="text-2xl font-bold text-white normal-case tracking-normal">
                  {form.ballsRemaining}
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-12 w-12 rounded-xl p-0 text-xl font-bold"
                onClick={() => {
                   const current = parseInt(form.ballsRemaining) || 0;
                   if (current < 7) updateForm({ ballsRemaining: (current + 1).toString() });
                }}
                disabled={!isSignedIn || saving}
              >
                +
              </Button>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
           disabled={!isSignedIn || saving || !form.winner}
        >
          {saving ? "Saving..." : "Add Game Result"}
        </Button>
      </form>
    </Card>
  );
}
