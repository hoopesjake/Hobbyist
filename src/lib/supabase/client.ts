"use client";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";
export function createClient() {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase environment variables are missing.");
  return createBrowserClient(config.url, config.key);
}
