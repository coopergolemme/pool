"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase/client";
import { Game } from "../lib/glicko";
import { mapGame } from "../lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { haptic } from "../lib/haptics";

interface PendingGamesProps {
  userId: string | null;
  userName: string | null;
  onUpdate: () => void;
}

export function PendingGames({ userId, userName, onUpdate }: PendingGamesProps) {
  const [pendingGames, setPendingGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId || !userName) {
        setPendingGames([]);
        return;
    }

    const fetchPending = async () => {
      setLoading(true);
      if (!supabase) return;

      // Fetch all pending games. 
      // We process filtering in memory for simplicity since the pending list is expected to be small.
      const { data } = await supabase
        .from("games")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (data) {
        const games = data.map(mapGame);
        // Filter: 
        // 1. I am one of the players
        // 2. I did NOT submit it (someone else did)
        const relevant = games.filter(g => {
            const amInGame = g.players.includes(userName);
            const isMySubmission = g.submittedBy === userId;
            return amInGame && !isMySubmission;
        });
        setPendingGames(relevant);
      }
      setLoading(false);
    };

    fetchPending();
  }, [userId, userName]);

  const handleAction = async (gameId: string, action: "accept" | "reject") => {
      if (!supabase) return;

      if (action === "accept") {
          const { error } = await supabase
            .from("games")
            .update({ status: "verified" })
            .eq("id", gameId);
          
          if (!error) {
              onUpdate(); // Refresh parent data
              setPendingGames(prev => prev.filter(g => g.id !== gameId));
          }
      } else {
          const { error } = await supabase
            .from("games")
            .delete()
            .eq("id", gameId);

          if (!error) {
              onUpdate();
              setPendingGames(prev => prev.filter(g => g.id !== gameId));
          }
      }
  };

  if (pendingGames.length === 0) return null;

  return (
    <div className="mb-6 space-y-4">
      <div className="rounded-3xl border border-yellow-500/20 bg-yellow-500/5 p-5 backdrop-blur sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-yellow-200">
          <span>⚠️</span> Pending Verification
        </h2>
        <div className="space-y-3">
          <AnimatePresence>
          {pendingGames.map((game) => (
            <motion.div 
               key={game.id} 
               layout
               initial={{ opacity: 0, height: 0 }}
               animate={{ opacity: 1, height: "auto" }}
               exit={{ opacity: 0, height: 0, scale: 0.95 }}
               transition={{ duration: 0.2 }}
               className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-black/40 p-4 sm:flex-row sm:items-center sm:justify-between overflow-hidden"
            >
              <div>
                <p className="text-sm font-medium text-white/90">
                  vs {game.players.find(p => p !== userName) || "Opponent"}
                </p>
                <div className="mt-1 flex gap-2 text-xs text-white/50">
                   <span>{game.format}</span>
                   <span>•</span>
                   <span>{new Date(game.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="mt-2 text-sm">
                    Result: <span className="font-bold text-white">{game.winner === userName ? "You Won" : "You Lost"}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    haptic.medium();
                    handleAction(game.id, "reject");
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/20 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => {
                    haptic.success();
                    handleAction(game.id, "accept");
                  }}
                  className="rounded-xl bg-green-500 text-black px-6 py-2 text-sm font-bold hover:bg-green-400 transition-colors"
                >
                  Verify
                </button>
              </div>
            </motion.div>
          ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
