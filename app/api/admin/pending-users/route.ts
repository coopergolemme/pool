import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireApprovedProfile,
  setRefreshedCookiesIfNeeded,
} from "@/lib/auth/require-approved-profile";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

type ApproveRequestBody = {
  userId?: string;
  action?: "approve";
};

export async function GET(request: Request) {
  try {
    const access = await requireApprovedProfile(request, { requireAdmin: true });
    if (!access.ok) return access.response;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, username, created_at")
      .eq("approved", false)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const response = NextResponse.json(
      { users: data ?? [] },
      { headers: PRIVATE_NO_STORE_HEADERS },
    );
    setRefreshedCookiesIfNeeded(response, access.refreshed);
    return response;
  } catch (error) {
    console.error("Error fetching pending users:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireApprovedProfile(request, { requireAdmin: true });
    if (!access.ok) return access.response;

    const { userId, action } = (await request.json()) as ApproveRequestBody;
    if (!userId || action !== "approve") {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("profiles")
      .update({ approved: true, approved_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("approved", false);

    if (error) throw error;

    const response = NextResponse.json(
      { success: true },
      { headers: PRIVATE_NO_STORE_HEADERS },
    );
    setRefreshedCookiesIfNeeded(response, access.refreshed);
    return response;
  } catch (error) {
    console.error("Error approving user:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
