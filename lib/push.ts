import { supabase } from "./supabase/client";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerPush(userId: string) {
  if (!('serviceWorker' in navigator) || !VAPID_PUBLIC_KEY) {
    console.warn('Push work not supported or missing public key');
    return;
  }

  try {
    await navigator.serviceWorker.register('/sw.js');
    const registration = await navigator.serviceWorker.ready;
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    // Store in Supabase
    if (supabase) {
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({ 
          user_id: userId, 
          subscription: subscription.toJSON() 
        }, { onConflict: 'user_id' }); // Currently assuming one sub per user for simplicity

      if (error) console.error('Error saving subscription to Supabase:', error);
    }

    return true;
  } catch (err) {
    console.error('Failed to register push:', err);
    return false;
  }
}

export async function checkPushPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}
