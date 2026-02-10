import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 400;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : DEFAULT_LIMIT;

    if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
      return NextResponse.json(
        { error: "Invalid limit. Provide a positive integer." },
        { status: 400 },
      );
    }

    const limit = Math.min(parsedLimit, MAX_LIMIT);
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("status", "verified")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return NextResponse.json({ games: data ?? [] });
  } catch (error) {
    console.error("Error fetching games:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
