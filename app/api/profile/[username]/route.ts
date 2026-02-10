import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapGame, type DbGame } from "@/lib/types";
import { parseTeam, type RatingHistory } from "@/lib/glicko";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS, profileTag } from "@/lib/cache-tags";

const MAX_GAMES = 1000;

const gameHasPlayer = (game: ReturnType<typeof mapGame>, username: string) => {
  const is2v2 = game.format === "8-ball-2v2";
  return game.players.some((team) => parseTeam(team, is2v2).includes(username));
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
};

type RouteContext = {
  params: Promise<{ username: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { username: rawUsername } = await context.params;
    const username = decodeURIComponent(rawUsername);
    const getProfilePayload = unstable_cache(
      async (requestedUsername: string) => {
        const supabase = createAdminClient();

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, username, email, rating, rd, vol, streak, wins, losses")
          .eq("username", requestedUsername)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profile) return null;

        const { data: gamesData, error: gamesError } = await supabase
          .from("games")
          .select("*")
          .eq("status", "verified")
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(MAX_GAMES);

        if (gamesError) throw gamesError;

        const allVerifiedGames = (gamesData ?? []).map((row) => mapGame(row as DbGame));
        const games = allVerifiedGames.filter((game) => gameHasPlayer(game, requestedUsername));
        const gameIds = games.map((game) => game.id);

        let ratingHistory: RatingHistory = {};
        if (gameIds.length > 0) {
          const { data: changes, error: changesError } = await supabase
            .from("game_rating_changes")
            .select("game_id, username, post_rating, rating_delta")
            .in("game_id", gameIds)
            .order("created_at", { ascending: false });

          if (changesError) throw changesError;

          ratingHistory = (changes ?? []).reduce<RatingHistory>((acc, row) => {
            if (!acc[row.game_id]) {
              acc[row.game_id] = {};
            }
            acc[row.game_id][row.username] = {
              rating: toNumber(row.post_rating),
              delta: toNumber(row.rating_delta),
            };
            return acc;
          }, {});
        }

        return {
          profile: {
            id: profile.id,
            username: profile.username,
            email: profile.email,
            rating: toNumber(profile.rating),
            rd: toNumber(profile.rd),
            vol: toNumber(profile.vol),
            streak: profile.streak ?? 0,
            wins: profile.wins ?? 0,
            losses: profile.losses ?? 0,
          },
          games,
          ratingHistory,
        };
      },
      ["api-profile-page-data"],
      {
        revalidate: 60,
        tags: [CACHE_TAGS.games, CACHE_TAGS.ratingHistory, CACHE_TAGS.profiles, profileTag(username)],
      },
    );

    const payload = await getProfilePayload(username);
    if (!payload) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error fetching profile page data:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
