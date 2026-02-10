import { supabase } from "./supabase/client";

export async function getConfig<T>(key: string, defaultValue: T): Promise<T> {
  if (!supabase) return defaultValue;

  const { data, error } = await supabase
    .from("config")
    .select("value")
    .eq("key", key)
    .single();

  if (error || !data) return defaultValue;
  return (data.value as T) ?? defaultValue;
}
