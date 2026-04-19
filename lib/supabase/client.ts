"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

let browserClient: SupabaseClient | undefined;

/**
 * 브라우저(클라이언트 컴포넌트)에서 사용하는 Supabase 싱글톤 클라이언트입니다.
 */
export function getBrowserSupabaseClient(): SupabaseClient {
  if (!browserClient) {
    const { url, anonKey } = getSupabaseEnv();
    browserClient = createClient(url, anonKey);
  }
  return browserClient;
}
