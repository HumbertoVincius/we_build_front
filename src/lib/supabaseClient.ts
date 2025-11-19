"use client";

import { createClient } from "@supabase/supabase-js";
import { ENV_KEYS } from "./env";

// Acesso direto necessário para o Next.js fazer tree-shaking correto no cliente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured =
  Boolean(supabaseUrl) && Boolean(supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn("Supabase environment variables are not set.");
  console.warn(`Looking for: ${ENV_KEYS.SUPABASE_URL} and ${ENV_KEYS.SUPABASE_ANON_KEY}`);
  console.warn(`URL value: ${supabaseUrl ? "set" : "not set"}`);
  console.warn(`Key value: ${supabaseAnonKey ? "set" : "not set"}`);
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: false
      }
    })
  : (null as unknown as ReturnType<typeof createClient>);

