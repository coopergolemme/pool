import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DbGame } from "@/lib/types";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS, profileTag, userStatsTag, userPendingTag } from "@/lib/cache-tags";
import { requireApprovedProfile, setRefreshedCookiesIfNeeded } from "@/lib/auth/require-approved-profile";
import { getRatingTrack, is2v2Format } from "@/lib/rating-track";

const toNumber = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const getProfileRatingFields = (format: string) => {
  const track = getRatingTrack(format);
  if (track === "9-ball") {
    return {
      rating: "rating_9ball",
      rd: "rd_9ball",
      vol: "vol_9ball",
      wins: "wins_9ball",
      losses: "losses_9ball",
      streak: "streak_9ball",
    } as const;
  }

  return {
    rating: "rating",
    rd: "rd",
    vol: "vol",
    wins: "wins",
    losses: "losses",
    streak: "streak",
  } as const;
};


export async function POST(request: Request) {
  try {
    const { gameId, action } = await request.json();
    
    if (!gameId || !action) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const access = await requireApprovedProfile(request);
    if (!access.ok) return access.response;
    const userId = access.userId;

    const supabase = createAdminClient();

    // 1. Fetch the game to verify permission
    const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();
    
    if (gameError || !gameData) {
        return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const game = gameData as DbGame;

    // Check permissions: User must be the opponent OR an admin
    const isAdmin = access.profile.role === "ADMIN";

    if (!isAdmin && game.opponent_id && game.opponent_id !== userId) {
         return NextResponse.json({ error: "Unauthorized: You are not the opponent" }, { status: 403 });
    }

    // 2. Perform Action
    if (action === "accept") {
        const { error: updateError } = await supabase
            .from("games")
            .update({ status: "verified" })
            .eq("id", gameId);
        
        if (updateError) throw updateError;
        revalidateTag(CACHE_TAGS.games, "max");
        if (game.opponent_id) {
          revalidateTag(userPendingTag(game.opponent_id), "max");
        }
    } else if (action === "reject") {
        const { error: deleteError } = await supabase
            .from("games")
            .delete()
            .eq("id", gameId);
             
        if (deleteError) throw deleteError;
        
        // If rejected, no need to update ratings as pending games don't affect ratings
        revalidateTag(CACHE_TAGS.games, "max");
        const response = NextResponse.json({ success: true });
        setRefreshedCookiesIfNeeded(response, access.refreshed);
        return response;
    } else {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // 3. Incremental Rating Update
    const is2v2 = is2v2Format(game.format ?? "8-ball");
    if (game.player_a && game.player_b && game.winner) {
      const { parseTeam, calculateNewRatings, DEFAULT_RATING, DEFAULT_RD, DEFAULT_VOL } = await import("@/lib/glicko");
      const fields = getProfileRatingFields(game.format ?? "8-ball");

      const teamAPlayers = parseTeam(game.player_a, is2v2);
      const teamBPlayers = parseTeam(game.player_b, is2v2);
      const allPlayerNames = [...teamAPlayers, ...teamBPlayers];

      // Fetch profiles for these players
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .in("username", allPlayerNames);

      if (!profileError && profiles) {
        const profileMap = new Map(profiles.map(p => [p.username, {
          rating: toNumber(p[fields.rating], DEFAULT_RATING),
          rd: toNumber(p[fields.rd], DEFAULT_RD),
          vol: toNumber(p[fields.vol], DEFAULT_VOL),
          wins: toNumber(p[fields.wins], 0),
          losses: toNumber(p[fields.losses], 0),
          streak: toNumber(p[fields.streak], 0)
        }]));

        const getStats = (name: string) => profileMap.get(name) || {
          rating: DEFAULT_RATING, rd: DEFAULT_RD, vol: DEFAULT_VOL, wins: 0, losses: 0, streak: 0
        };

        const teamARating = teamAPlayers.reduce((sum, name) => sum + getStats(name).rating, 0) / teamAPlayers.length;
        const teamBRD = teamBPlayers.reduce((sum, name) => sum + getStats(name).rd, 0) / teamBPlayers.length;
        
        const teamBRating = teamBPlayers.reduce((sum, name) => sum + getStats(name).rating, 0) / teamBPlayers.length;
        const teamARD = teamAPlayers.reduce((sum, name) => sum + getStats(name).rd, 0) / teamAPlayers.length;

        const teamAIsWinner = game.winner === game.player_a;
        const scoreA = teamAIsWinner ? 1 : 0;
        const scoreB = teamAIsWinner ? 0 : 1;

        type ProfileUpdate = {
          id: string;
          [key: string]: string | number;
        };

        const updates: ProfileUpdate[] = [];
        const ratingChanges: Array<{
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
        }> = [];

        teamAPlayers.forEach(name => {
          const profile = profiles.find(p => p.username === name);
          if (profile) {
            const previous = getStats(name);
            const newStats = calculateNewRatings(previous, teamBRating, teamBRD, scoreA);
            updates.push({
              id: profile.id,
              [fields.rating]: newStats.rating,
              [fields.rd]: newStats.rd,
              [fields.vol]: newStats.vol,
              [fields.wins]: newStats.wins,
              [fields.losses]: newStats.losses,
              [fields.streak]: newStats.streak
            });
            ratingChanges.push({
              game_id: game.id,
              profile_id: profile.id,
              username: name,
              format: game.format ?? "8-ball",
              result: scoreA === 1 ? "win" : "loss",
              pre_rating: previous.rating,
              post_rating: newStats.rating,
              pre_rd: previous.rd,
              post_rd: newStats.rd,
              pre_vol: previous.vol,
              post_vol: newStats.vol,
            });
          }
        });

        teamBPlayers.forEach(name => {
          const profile = profiles.find(p => p.username === name);
          if (profile) {
            const previous = getStats(name);
            const newStats = calculateNewRatings(previous, teamARating, teamARD, scoreB);
            updates.push({
              id: profile.id,
              [fields.rating]: newStats.rating,
              [fields.rd]: newStats.rd,
              [fields.vol]: newStats.vol,
              [fields.wins]: newStats.wins,
              [fields.losses]: newStats.losses,
              [fields.streak]: newStats.streak
            });
            ratingChanges.push({
              game_id: game.id,
              profile_id: profile.id,
              username: name,
              format: game.format ?? "8-ball",
              result: scoreB === 1 ? "win" : "loss",
              pre_rating: previous.rating,
              post_rating: newStats.rating,
              pre_rd: previous.rd,
              post_rd: newStats.rd,
              pre_vol: previous.vol,
              post_vol: newStats.vol,
            });
          }
        });

        if (updates.length > 0) {
          await Promise.all(
            updates.map(async (update) => {
              const { id, ...data } = update;
              const { error: updateError } = await supabase
                .from("profiles")
                .update(data)
                .eq("id", id);
              
              if (updateError) {
                console.error(`Rating update failed for profile ${id}`, updateError);
              }
            })
          );
        }

        if (ratingChanges.length > 0) {
          const { error: historyError } = await supabase
            .from("game_rating_changes")
            .upsert(ratingChanges, { onConflict: "game_id,profile_id" });
          if (historyError) console.error("Rating history insert failed", historyError);
        }

        revalidateTag(CACHE_TAGS.games, "max");
        revalidateTag(CACHE_TAGS.leaderboard, "max");
        revalidateTag(CACHE_TAGS.streaks, "max");
        revalidateTag(CACHE_TAGS.ratingHistory, "max");
        revalidateTag(CACHE_TAGS.profiles, "max");
        for (const name of new Set(allPlayerNames)) {
          revalidateTag(profileTag(name), "max");
          // Find the profile ID for this user to invalidate their stats
          const profile = profiles.find(p => p.username === name);
          if (profile) {
            revalidateTag(userStatsTag(profile.id), "max");
          }
        }
      }
    }

    const response = NextResponse.json({ success: true });
    setRefreshedCookiesIfNeeded(response, access.refreshed);
    return response;

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Verification error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
