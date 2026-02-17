export const CACHE_TAGS = {
  games: "games",
  leaderboard: "leaderboard",
  streaks: "streaks",
  ratingHistory: "rating-history",
  profiles: "profiles",
} as const;

export const profileTag = (username: string) =>
  `profile:${username.trim().toLowerCase()}`;

export const userStatsTag = (userId: string) => `stats:${userId}`;
export const userPendingTag = (userId: string) => `pending:${userId}`;
