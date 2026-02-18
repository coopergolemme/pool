import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerAuthClient } from "@/lib/supabase/server-auth";
import { sendPushToUsers } from "@/lib/push/server";

export async function POST(request: Request) {
  try {
    const { email, password, username } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const authClient = createServerAuthClient();
    const { data, error } = await authClient.auth.signUp({ email, password });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json({ error: "Could not create user" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    await adminClient.from("profiles").upsert(
      { id: data.user.id, email, username: username || null, approved: false, role: "USER" },
      { onConflict: "id" },
    );

    const { data: admins, error: adminsError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("role", "ADMIN")
      .eq("approved", true);

    if (adminsError) {
      console.error("Failed to load admins for signup notification:", adminsError);
    } else {
      const adminIds = (admins ?? []).map((row) => row.id as string);
      const displayName = username?.trim() ? username.trim() : email;
      sendPushToUsers(adminIds, {
        title: "New Signup Request",
        body: `${displayName} requested access to the app.`,
        url: "/admin",
      }).catch((notifyError) => {
        console.error("Failed to notify admins about signup request:", notifyError);
      });
    }

    const response = NextResponse.json({
      user: { id: data.user.id, email: data.user.email },
      requiresApproval: true,
      needsEmailConfirmation: !data.session,
    });

    return response;
  } catch (error) {
    console.error("Error in sign-up route:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
