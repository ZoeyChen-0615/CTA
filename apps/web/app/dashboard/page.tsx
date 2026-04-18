import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import DashboardClient from "@/components/DashboardClient";
import type { Route, RouteHistoryPoint, Vehicle } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const historySince = new Date(Date.now() - 30 * 60_000).toISOString();

  const [{ data: routes }, { data: favorites }, { data: vehicles }, { data: history }] =
    await Promise.all([
      supabase.from("transit_routes").select("*").order("mode").order("route_id"),
      supabase.from("transit_favorites").select("route_id"),
      supabase.from("transit_vehicles").select("*"),
      supabase
        .from("transit_route_history")
        .select("route_id, ts, vehicle_count")
        .gte("ts", historySince)
        .order("ts", { ascending: true }),
    ]);

  return (
    <DashboardClient
      userEmail={user.email ?? ""}
      routes={(routes ?? []) as Route[]}
      favoriteRouteIds={(favorites ?? []).map((f) => f.route_id)}
      initialVehicles={(vehicles ?? []) as Vehicle[]}
      initialHistory={(history ?? []) as RouteHistoryPoint[]}
    />
  );
}
