import { type Game } from "./glicko";

export type RatingTrack = "8-ball" | "9-ball";

export const getRatingTrack = (format: Game["format"] | string): RatingTrack => {
  return format === "9-ball" ? "9-ball" : "8-ball";
};

export const is2v2Format = (format: Game["format"] | string) => {
  return format === "8-ball-2v2";
};

