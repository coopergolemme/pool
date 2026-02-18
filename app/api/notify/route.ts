import { NextResponse } from 'next/server';
import { sendPushToUsers } from "@/lib/push/server";

export async function POST(request: Request) {
  try {
    const { userId, title, body, url } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const result = await sendPushToUsers([userId], { title, body, url });
    if (result.totalSubscriptions === 0) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, results: result.results });
  } catch (error: unknown) {
    console.error('Push error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
