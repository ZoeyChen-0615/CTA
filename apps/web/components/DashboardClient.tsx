"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type { Route, Vehicle, VehicleHistoryPoint } from "@/lib/types";
import RoutePicker from "./RoutePicker";

const TRAIL_WINDOW_MS = 10 * 60_000;

// Leaflet hits window on import, so the map is client-only.
const TransitMap = dynamic(() => import("./TransitMap"), { ssr: false });

type Props = {
  userEmail: string;
  routes: Route[];
  favoriteRouteIds: string[];
  initialVehicles: Vehicle[];
};

export default function DashboardClient({
  userEmail,
  routes,
  favoriteRouteIds: initialFavorites,
  initialVehicles,
}: Props) {
  const supabaseRef = useRef(createClient());
  const [favorites, setFavorites] = useState<Set<string>>(new Set(initialFavorites));
  const [vehicles, setVehicles] = useState<Map<string, Vehicle>>(
    () => new Map(initialVehicles.map((v) => [v.vehicle_id, v]))
  );
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [trailsOn, setTrailsOn] = useState(false);
  const [trails, setTrails] = useState<Map<string, [number, number][]>>(new Map());

  // Subscribe to Realtime vehicle changes.
  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel("transit_vehicles")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transit_vehicles" },
        (payload) => {
          setLastUpdate(new Date());
          setVehicles((prev) => {
            const next = new Map(prev);
            if (payload.eventType === "DELETE") {
              const oldId = (payload.old as Vehicle | null)?.vehicle_id;
              if (oldId) next.delete(oldId);
            } else {
              const row = payload.new as Vehicle;
              next.set(row.vehicle_id, row);
            }
            return next;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleFavorite = useCallback(async (routeId: string) => {
    const supabase = supabaseRef.current;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const willFavorite = !favorites.has(routeId);
    // Optimistic
    setFavorites((prev) => {
      const next = new Set(prev);
      if (willFavorite) next.add(routeId);
      else next.delete(routeId);
      return next;
    });

    if (willFavorite) {
      const { error } = await supabase
        .from("transit_favorites")
        .insert({ user_id: user.id, route_id: routeId });
      if (error) console.error(error);
    } else {
      const { error } = await supabase
        .from("transit_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("route_id", routeId);
      if (error) console.error(error);
    }
  }, [favorites]);

  const visibleVehicles = useMemo(() => {
    if (favorites.size === 0) return [];
    return Array.from(vehicles.values()).filter((v) => favorites.has(v.route_id));
  }, [vehicles, favorites]);

  const routeColors = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of routes) m.set(r.route_id, r.color);
    return m;
  }, [routes]);

  // Fetch trails for visible vehicles while the trails layer is on, and refresh
  // on every realtime tick (cheap: we only query history for favorited routes).
  useEffect(() => {
    if (!trailsOn) {
      setTrails(new Map());
      return;
    }
    const routeIds = Array.from(favorites);
    if (routeIds.length === 0) {
      setTrails(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - TRAIL_WINDOW_MS).toISOString();
      const { data, error } = await supabaseRef.current
        .from("transit_vehicle_history")
        .select("vehicle_id, lat, lon, recorded_at")
        .in("route_id", routeIds)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error("trails fetch:", error);
        return;
      }
      const grouped = new Map<string, [number, number][]>();
      for (const p of (data ?? []) as VehicleHistoryPoint[]) {
        const arr = grouped.get(p.vehicle_id) ?? [];
        arr.push([Number(p.lat), Number(p.lon)]);
        grouped.set(p.vehicle_id, arr);
      }
      setTrails(grouped);
    })();
    return () => {
      cancelled = true;
    };
  }, [trailsOn, favorites, lastUpdate]);

  const totalTracked = vehicles.size;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-950 px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚌</span>
          <div>
            <div className="text-sm font-semibold">CTA Transit Tracker</div>
            <div className="text-xs text-gray-500">
              {totalTracked} vehicles tracked · last update {lastUpdate.toLocaleTimeString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-400">{userEmail}</span>
          <form action="/auth/sign-out" method="post">
            <button className="rounded bg-gray-800 px-3 py-1 text-xs hover:bg-gray-700">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 overflow-y-auto border-r border-gray-800 bg-gray-950 p-4">
          <RoutePicker routes={routes} favorites={favorites} onToggle={toggleFavorite} />
        </aside>

        <main className="relative flex-1">
          <TransitMap
            vehicles={visibleVehicles}
            routeColors={routeColors}
            trails={trailsOn ? trails : null}
          />
          <button
            onClick={() => setTrailsOn((v) => !v)}
            className={`absolute right-4 top-4 z-[1000] rounded-lg px-3 py-2 text-xs font-medium shadow-lg transition ${
              trailsOn
                ? "bg-yellow-400 text-gray-900 hover:bg-yellow-300"
                : "bg-gray-900/90 text-gray-100 hover:bg-gray-800"
            }`}
            title="Show the last 10 minutes of each favored vehicle's path"
          >
            {trailsOn ? "✓ Trails (last 10 min)" : "Show trails"}
          </button>
          {favorites.size === 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
              <div className="pointer-events-auto rounded-lg bg-gray-900/90 px-4 py-2 text-sm text-gray-200 shadow-lg">
                ⭐ Star some routes on the left to see them on the map.
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
