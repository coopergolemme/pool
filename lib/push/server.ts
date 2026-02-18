import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

type PushSubscriptionRow = {
  user_id: string;
  subscription: webpush.PushSubscription;
};

let configured = false;
let enabled = true;

const ensureWebPushConfigured = () => {
  if (configured) return enabled;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    enabled = false;
    configured = true;
    return false;
  }

  webpush.setVapidDetails("mailto:support@example.com", publicKey, privateKey);
  configured = true;
  return true;
};

export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (!ensureWebPushConfigured()) {
    return { totalSubscriptions: 0, results: [] as PromiseSettledResult<unknown>[] };
  }

  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) {
    return { totalSubscriptions: 0, results: [] as PromiseSettledResult<unknown>[] };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("user_id, subscription")
    .in("user_id", uniqueUserIds);

  if (error) throw error;

  const rows = (data ?? []) as PushSubscriptionRow[];
  if (rows.length === 0) {
    return { totalSubscriptions: 0, results: [] as PromiseSettledResult<unknown>[] };
  }

  const pushPayload = JSON.stringify(payload);
  const results = await Promise.allSettled(
    rows.map((row) => webpush.sendNotification(row.subscription, pushPayload)),
  );

  return { totalSubscriptions: rows.length, results };
}
