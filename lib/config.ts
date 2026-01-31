import { supabase } from "./supabase/client";

export async function getConfig(key: string, defaultValue: any = null) {
  if (!supabase) return defaultValue;

  const { data, error } = await supabase
    .from("config")
    .select("value")
    .eq("key", key)
    .single();

  if (error || !data) return defaultValue;
  return data.value;
}
