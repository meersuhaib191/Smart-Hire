"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseUrl, publicAnonKey } from "@/utils/supabase/info";

export const createClient = () => createBrowserClient(supabaseUrl, publicAnonKey);

// Backward compatibility for existing imports in the app.
export const supabase = createClient();
