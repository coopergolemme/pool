import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerAuthClient, setAuthCookies } from "@/lib/supabase/server-auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const authClient = createServerAuthClient();
    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session?.access_token || !data.session?.refresh_token || !data.user) {
      return NextResponse.json({ error: error?.message ?? "Invalid credentials" }, { status: 401 });
    }

    const adminClient = createAdminClient();
    await adminClient
      .from("profiles")
      .upsert({ id: data.user.id, email: data.user.email ?? email }, { onConflict: "id" });

    const response = NextResponse.json({ user: { id: data.user.id, email: data.user.email } });
    setAuthCookies(response, data.session.access_token, data.session.refresh_token);

    return response;
  } catch (error) {
    console.error("Error in sign-in route:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
