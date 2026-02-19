import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApprovedProfile, setRefreshedCookiesIfNeeded } from "@/lib/auth/require-approved-profile";
import { CACHE_TAGS, profileTag } from "@/lib/cache-tags";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 24;

type UpdateProfileBody = {
  username?: string;
  notificationsEnabled?: boolean;
};

const normalizeUsername = (value: string) => value.trim().replace(/\s+/g, "");

const isValidUsername = (value: string) =>
  value.length >= MIN_USERNAME_LENGTH &&
  value.length <= MAX_USERNAME_LENGTH &&
  USERNAME_PATTERN.test(value);

const renameInTeam = (value: string, oldUsername: string, newUsername: string) => {
  const parts = value.split("&").map((part) => part.trim());
  if (!parts.includes(oldUsername)) return value;
  return parts.map((part) => (part === oldUsername ? newUsername : part)).join(" & ");
};

export async function GET(request: Request) {
  try {
    const access = await requireApprovedProfile(request);
    if (!access.ok) return access.response;

    const supabase = createAdminClient();
    const [{ data: profile, error: profileError }, { data: subscription, error: subError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, username")
          .eq("id", access.userId)
          .maybeSingle(),
        supabase
          .from("push_subscriptions")
          .select("id")
          .eq("user_id", access.userId)
          .maybeSingle(),
      ]);

    if (profileError) throw profileError;
    if (subError) throw subError;

    const response = NextResponse.json(
      {
        profile: profile
          ? {
              id: profile.id,
              email: profile.email,
              username: profile.username,
              notificationsEnabled: Boolean(subscription?.id),
            }
          : null,
      },
      { headers: PRIVATE_NO_STORE_HEADERS },
    );
    setRefreshedCookiesIfNeeded(response, access.refreshed);
    return response;
  } catch (error) {
    console.error("Error fetching current profile:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await requireApprovedProfile(request);
    if (!access.ok) return access.response;

    const body = (await request.json()) as UpdateProfileBody;
    const hasUsername = typeof body.username === "string";
    const hasNotifications = typeof body.notificationsEnabled === "boolean";

    if (!hasUsername && !hasNotifications) {
      return NextResponse.json(
        { error: "No valid fields provided." },
        { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }

    const supabase = createAdminClient();
    const { data: currentProfile, error: currentProfileError } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("id", access.userId)
      .maybeSingle();

    if (currentProfileError) throw currentProfileError;
    if (!currentProfile) {
      return NextResponse.json(
        { error: "Profile not found." },
        { status: 404, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }

    const previousUsername = currentProfile.username;
    let updatedUsername = currentProfile.username;

    if (hasUsername) {
      const normalizedUsername = normalizeUsername(body.username ?? "");
      if (!isValidUsername(normalizedUsername)) {
        return NextResponse.json(
          {
            error:
              "Username must be 3-24 characters and only include letters, numbers, ., _, -",
          },
          { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
        );
      }

      if (normalizedUsername !== currentProfile.username) {
        const { data: existing, error: existingError } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", normalizedUsername)
          .neq("id", access.userId)
          .maybeSingle();

        if (existingError) throw existingError;
        if (existing) {
          return NextResponse.json(
            { error: "That username is already taken." },
            { status: 409, headers: PRIVATE_NO_STORE_HEADERS },
          );
        }

        const { error: profileUpdateError } = await supabase
          .from("profiles")
          .update({ username: normalizedUsername })
          .eq("id", access.userId);

        if (profileUpdateError) throw profileUpdateError;
        updatedUsername = normalizedUsername;

        // Keep historical name references consistent with the current username.
        const { error: historyError } = await supabase
          .from("game_rating_changes")
          .update({ username: normalizedUsername })
          .eq("profile_id", access.userId);
        if (historyError) throw historyError;

        if (currentProfile.username) {
          const { data: games, error: gamesError } = await supabase
            .from("games")
            .select("id, player_a, player_b, winner")
            .or(
              `player_a.ilike.%${currentProfile.username}%,player_b.ilike.%${currentProfile.username}%,winner.ilike.%${currentProfile.username}%`,
            );
          if (gamesError) throw gamesError;

          for (const game of games ?? []) {
            const nextPlayerA = renameInTeam(
              game.player_a ?? "",
              currentProfile.username,
              normalizedUsername,
            );
            const nextPlayerB = renameInTeam(
              game.player_b ?? "",
              currentProfile.username,
              normalizedUsername,
            );
            const nextWinner = renameInTeam(
              game.winner ?? "",
              currentProfile.username,
              normalizedUsername,
            );

            if (
              nextPlayerA !== game.player_a ||
              nextPlayerB !== game.player_b ||
              nextWinner !== game.winner
            ) {
              const { error: gameUpdateError } = await supabase
                .from("games")
                .update({
                  player_a: nextPlayerA,
                  player_b: nextPlayerB,
                  winner: nextWinner,
                })
                .eq("id", game.id);
              if (gameUpdateError) throw gameUpdateError;
            }
          }
        }
      }
    }

    if (hasNotifications && body.notificationsEnabled === false) {
      const { error: removeSubscriptionError } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", access.userId);
      if (removeSubscriptionError) throw removeSubscriptionError;
    }

    revalidateTag(CACHE_TAGS.profiles, "max");
    revalidateTag(CACHE_TAGS.games, "max");
    revalidateTag(CACHE_TAGS.leaderboard, "max");
    revalidateTag(CACHE_TAGS.streaks, "max");
    revalidateTag(CACHE_TAGS.ratingHistory, "max");
    if (previousUsername) revalidateTag(profileTag(previousUsername), "max");
    if (updatedUsername) revalidateTag(profileTag(updatedUsername), "max");

    const response = NextResponse.json(
      {
        success: true,
        profile: {
          id: access.userId,
          username: updatedUsername,
        },
      },
      { headers: PRIVATE_NO_STORE_HEADERS },
    );
    setRefreshedCookiesIfNeeded(response, access.refreshed);
    return response;
  } catch (error) {
    console.error("Error updating current profile:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
