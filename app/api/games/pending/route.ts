import { getAuthUserFromRequest, setAuthCookies } from "@/lib/supabase/server-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { user, refreshed } = await getAuthUserFromRequest(request);
    const userId = user?.id;

    console.log("Fetching pending games for user:", userId);
    
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = NextResponse.json({ pending: true });
    if (refreshed) {
        setAuthCookies(response, refreshed.accessToken, refreshed.refreshToken);
    }
    return response;
    
}
