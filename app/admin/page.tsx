"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Header } from "@/components/Header";
import { mapGame } from "@/lib/types";
import { Game } from "@/lib/glicko";
import { motion, AnimatePresence } from "framer-motion";
import { haptic } from "@/lib/haptics";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/Skeleton";
import Link from "next/link";

export default function AdminPage() {
    const [loading, setLoading] = useState(true);
    const [games, setGames] = useState<Game[]>([]);
    const [userId, setUserId] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        if (!supabase) return;

        const checkAuth = async () => {
            if (!supabase) return;
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setLoading(false);
                return;
            }

            setUserId(session.user.id);

            const { data: profile } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", session.user.id)
                .single();

            if (profile?.role === "ADMIN") {
                setIsAdmin(true);
                fetchPendingGames();
            } else {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    const fetchPendingGames = async () => {
        if (!supabase) return;
        const { data } = await supabase
            .from("games")
            .select("*")
            .eq("status", "pending")
            .order("created_at", { ascending: false });

        if (data) {
            setGames(data.map(mapGame));
        }
        setLoading(false);
    };

    const handleAction = async (gameId: string, action: "accept" | "reject") => {
        try {
            const res = await fetch("/api/games/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ gameId, action, userId })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to process request");
            }

            toast.success(action === "accept" ? "Game verified!" : "Game rejected");
            setGames(prev => prev.filter(g => g.id !== gameId));

        } catch (error: unknown) {
            console.error("Error processing game:", error);
            const msg = error instanceof Error ? error.message : "Unknown error";
            toast.error("Failed: " + msg);
        }
    };

    if (loading) {
        return (
            <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-24 pt-8 sm:px-6">
                <Header />
                <div className="space-y-4">
                    <Skeleton className="h-10 w-1/3" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            </main>
        )
    }

    if (!isAdmin) {
        return (
            <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-24 pt-8 sm:px-6">
                <Header />
                <div className="text-center py-20">
                    <h1 className="text-2xl font-bold text-red-500 mb-4">Access Denied</h1>
                    <p className="text-white/60 mb-8">You do not have permission to view this page.</p>
                    <Link href="/" className="px-6 py-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
                        Go Home
                    </Link>
                </div>
            </main>
        )
    }

    return (
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-24 pt-8 sm:px-6">
            <Header />

            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
                <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-xs font-medium text-white/60">
                    {games.length} Pending
                </div>
            </div>

            {games.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center">
                    <p className="text-white/40">No pending games to verify.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <AnimatePresence>
                        {games.map((game) => (
                            <motion.div
                                key={game.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-white/5 p-5 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-yellow-400 text-xs font-bold uppercase tracking-wider bg-yellow-400/10 px-2 py-0.5 rounded">
                                            {game.format}
                                        </span>
                                        <span className="text-white/40 text-xs">
                                            {new Date(game.createdAt).toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-4 text-lg">
                                        <span className={game.winner === game.players[0] ? "font-bold text-green-400" : "text-white"}>
                                            {game.players[0]}
                                        </span>
                                        <span className="text-white/30 text-sm">vs</span>
                                        <span className={game.winner === game.players[1] ? "font-bold text-green-400" : "text-white"}>
                                            {game.players[1]}
                                        </span>
                                    </div>
                                    {game.submittedBy && (
                                        <div className="mt-2 text-xs text-white/40">
                                            Submitted by: {game.submittedBy} (ID)
                                        </div>
                                    )}
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
            )}
        </main>
    );
}
