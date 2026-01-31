import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin credentials missing");
  return createClient(url, key);
};

webpush.setVapidDetails(
  'mailto:support@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export async function POST(request: Request) {
  try {
    const { userId, title, body, url } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Fetch subscription from Supabase
    const { data: subs, error: fetchError } = await supabaseAdmin()
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId);

    if (fetchError || !subs || subs.length === 0) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    const payload = JSON.stringify({ title, body, url });

    const results = await Promise.allSettled(
      subs.map(row => webpush.sendNotification(row.subscription as any, payload))
    );

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Push error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
