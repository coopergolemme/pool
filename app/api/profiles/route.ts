import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApprovedProfile, setRefreshedCookiesIfNeeded } from "@/lib/auth/require-approved-profile";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

export async function GET(request: Request) {
  try {
    const access = await requireApprovedProfile(request);
    if (!access.ok) return access.response;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, email")
      .eq("approved", true)
      .not("username", "is", null)
      .order("username", { ascending: true });

    if (error) {
      throw error;
    }

    const response = NextResponse.json(
      { profiles: data ?? [] },
      { headers: PRIVATE_NO_STORE_HEADERS },
    );
    setRefreshedCookiesIfNeeded(response, access.refreshed);

    return response;
  } catch (error) {
    console.error("Error fetching profiles:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
