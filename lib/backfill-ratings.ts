import { type SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_RATING,
  DEFAULT_RD,
  DEFAULT_VOL,
  calculateNewRatings,
  parseTeam,
  type GlickoPlayer,
} from "./glicko";
import { mapGame, type DbGame } from "./types";

const PROFILE_BATCH_SIZE = 500;
const RATING_CHANGE_BATCH_SIZE = 1000;

type Profile = {
  id: string;
  username: string | null;
  email: string | null;
};

type RatingChangeInsert = {
  game_id: string;
  profile_id: string;
  username: string;
  format: string;
  result: "win" | "loss";
  pre_rating: number;
  post_rating: number;
  pre_rd: number;
  post_rd: number;
  pre_vol: number;
  post_vol: number;
  created_at: string;
};

type ProfileUpdate = {
  id: string;
  email: string | null;
  username: string;
  rating: number;
  rd: number;
  vol: number;
  wins: number;
  losses: number;
  streak: number;
};

export type BackfillResult = {
  gamesProcessed: number;
  profilesUpdated: number;
  ratingChangesUpserted: number;
  updatedUsernames: string[];
};

const defaultPlayer = (): GlickoPlayer => ({
  rating: DEFAULT_RATING,
  rd: DEFAULT_RD,
  vol: DEFAULT_VOL,
  wins: 0,
  losses: 0,
  streak: 0,
});

const ensurePlayer = (players: Map<string, GlickoPlayer>, name: string) => {
  if (!players.has(name)) {
    players.set(name, defaultPlayer());
  }
  return players.get(name)!;
};

const upsertInBatches = async <T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
  batchSize: number,
  onConflict?: string,
) => {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const query = supabase
      .from(table)
      .upsert(batch, onConflict ? { onConflict } : undefined);
    const { error } = await query;
    if (error) {
      throw error;
    }
  }
};

export async function runRatingsBackfill(
  supabase: SupabaseClient,
): Promise<BackfillResult> {
  const { data: gamesData, error: gamesError } = await supabase
    .from("games")
    .select("*")
    .eq("status", "verified")
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  if (gamesError || !gamesData) {
    throw gamesError ?? new Error("Failed to fetch games");
  }

  const games = gamesData.map((g) => mapGame(g as DbGame));

  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, email");

  if (profilesError || !profilesData) {
    throw profilesError ?? new Error("Failed to fetch profiles");
  }

  const profileByUsername = new Map<string, Profile>();
  for (const profile of profilesData as Profile[]) {
    if (profile.username) {
      profileByUsername.set(profile.username, profile);
    }
  }

  const players = new Map<string, GlickoPlayer>();
  const ratingChanges: RatingChangeInsert[] = [];

  for (const game of games) {
    const is2v2 = game.format === "8-ball-2v2";
    const [sideA, sideB] = game.players;
    if (!sideA || !sideB || !game.winner) continue;

    const teamAPlayers = parseTeam(sideA, is2v2);
    const teamBPlayers = parseTeam(sideB, is2v2);
    if (teamAPlayers.length === 0 || teamBPlayers.length === 0) continue;

    for (const name of [...teamAPlayers, ...teamBPlayers]) {
      ensurePlayer(players, name);
    }

    const teamAIsWinner = game.winner === sideA;
    const teamBIsWinner = game.winner === sideB;
    if (!teamAIsWinner && !teamBIsWinner) continue;

    const scoreA = teamAIsWinner ? 1 : 0;
    const scoreB = teamBIsWinner ? 1 : 0;

    const teamARating =
      teamAPlayers.reduce((sum, name) => sum + ensurePlayer(players, name).rating, 0) /
      teamAPlayers.length;
    const teamBRating =
      teamBPlayers.reduce((sum, name) => sum + ensurePlayer(players, name).rating, 0) /
      teamBPlayers.length;
    const teamARD =
      teamAPlayers.reduce((sum, name) => sum + ensurePlayer(players, name).rd, 0) /
      teamAPlayers.length;
    const teamBRD =
      teamBPlayers.reduce((sum, name) => sum + ensurePlayer(players, name).rd, 0) /
      teamBPlayers.length;

    const applyUpdate = (
      name: string,
      score: number,
      oppRating: number,
      oppRd: number,
      result: "win" | "loss",
    ) => {
      const previous = ensurePlayer(players, name);
      const next = calculateNewRatings(previous, oppRating, oppRd, score);
      players.set(name, next);

      const profile = profileByUsername.get(name);
      if (!profile) return;

      ratingChanges.push({
        game_id: game.id,
        profile_id: profile.id,
        username: name,
        format: game.format,
        result,
        pre_rating: previous.rating,
        post_rating: next.rating,
        pre_rd: previous.rd,
        post_rd: next.rd,
        pre_vol: previous.vol,
        post_vol: next.vol,
        created_at: game.createdAt,
      });
    };

    for (const name of teamAPlayers) {
      applyUpdate(name, scoreA, teamBRating, teamBRD, scoreA === 1 ? "win" : "loss");
    }
    for (const name of teamBPlayers) {
      applyUpdate(name, scoreB, teamARating, teamARD, scoreB === 1 ? "win" : "loss");
    }
  }

  const profileUpdates: ProfileUpdate[] = [];

  for (const [username, stats] of players.entries()) {
    const profile = profileByUsername.get(username);
    if (!profile) continue;
    profileUpdates.push({
      id: profile.id,
      email: profile.email,
      username,
      rating: stats.rating,
      rd: stats.rd,
      vol: stats.vol,
      wins: stats.wins,
      losses: stats.losses,
      streak: stats.streak,
    });
  }

  if (profileUpdates.length > 0) {
    await upsertInBatches(supabase, "profiles", profileUpdates, PROFILE_BATCH_SIZE);
  }

  if (ratingChanges.length > 0) {
    await upsertInBatches(
      supabase,
      "game_rating_changes",
      ratingChanges,
      RATING_CHANGE_BATCH_SIZE,
      "game_id,profile_id",
    );
  }

  return {
    gamesProcessed: games.length,
    profilesUpdated: profileUpdates.length,
    ratingChangesUpserted: ratingChanges.length,
    updatedUsernames: Array.from(players.keys()),
  };
}
