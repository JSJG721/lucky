import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * 서버 전용(Route Handler, Server Component, Server Action)에서 사용하는 Supabase 클라이언트입니다.
 * anon 키는 공개되어도 되지만 RLS로 보호해야 합니다.
 */
export function createServerSupabaseClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createClient(url, anonKey);
}
