import { type Game } from "./glicko";

export type DbGame = {
  id: string;
  date: string | null;
  table_name: string | null;
  format: string | null;
  race_to: number | null;
  player_a: string | null;
  player_b: string | null;
  winner: string | null;
  score: string | null;
  opponent_id: string | null;
  opponent_email: string | null;
  created_at: string | null;
  status: string | null;
  submitted_by: string | null;
};

export const mapGame = (row: DbGame): Game => {
  const format = (row.format ?? "8-ball") as Game["format"];
  return {
    id: row.id,
    date: row.date ?? "",
    table: row.table_name ?? "Table 1",
    format,
    players: [row.player_a ?? "", row.player_b ?? ""],
    winner: row.winner ?? "",
    score: row.score ?? "",
    createdAt: row.created_at ?? "",
    status: (row.status as "pending" | "verified") ?? "verified",
    submittedBy: row.submitted_by ?? undefined,
  };
};

export const formatLabels: Record<Game["format"], string> = {
  "8-ball": "8-Ball",
  "8-ball-2v2": "2v2 8-Ball",
};
