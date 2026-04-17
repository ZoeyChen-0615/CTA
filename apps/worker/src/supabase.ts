import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function makeServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type VehicleRow = {
  vehicle_id: string;
  route_id: string;
  mode: "train" | "bus";
  lat: number;
  lon: number;
  heading: number | null;
  destination: string | null;
  speed: number | null;
  delayed: boolean;
  source_updated_at: string | null;
};
