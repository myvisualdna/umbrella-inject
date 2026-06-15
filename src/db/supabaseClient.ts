/**
 * Server-side Supabase client for ingestion scripts.
 * Never import this module from browser/frontend code.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../config/logger";

interface SupabaseEnv {
  url: string;
  serviceRoleKey: string;
}

let supabaseClient: SupabaseClient | null = null;
let hasLoggedHost = false;

function resolveSupabaseEnv(): SupabaseEnv {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url) {
    throw new Error(
      "Missing Supabase URL. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_PROJECT_URL / NEXT_PUBLIC_SUPABASE_URL)."
    );
  }
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return { url, serviceRoleKey };
}

export function hasSupabaseEnv(): boolean {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(url && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const { url, serviceRoleKey } = resolveSupabaseEnv();
  supabaseClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (!hasLoggedHost) {
    try {
      const host = new URL(url).host;
      logger.info("Supabase client initialized", { host });
    } catch {
      logger.info("Supabase client initialized");
    }
    hasLoggedHost = true;
  }

  return supabaseClient;
}
