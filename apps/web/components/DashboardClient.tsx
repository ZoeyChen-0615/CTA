"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type { Route, RouteHistoryPoint, Vehicle } from "@/lib/types";
import RoutePicker from "./RoutePicker";

const HISTORY_WINDOW_MS = 30 * 60_000;

// Leaflet hits window on import, so the map is client-only.
const TransitMap = dynamic(() => import("./TransitMap"), { ssr: false });

type Props = {
  userEmail: string;
  routes: Route[];
  favoriteRouteIds: string[];
  initialVehicles: Vehicle[];
  initialHistory: RouteHistoryPoint[];
};

export default function DashboardClient({
  userEmail,
  routes,
  favoriteRouteIds: initialFavorites,
  initialVehicles,
  initialHistory,
}: Props) {
  const supabaseRef = useRef(createClient());
  const [favorites, setFavorites] = useState<Set<string>>(new Set(initialFavorites));
  const [vehicles, setVehicles] = useState<Map<string, Vehicle>>(
    () => new Map(initialVehicles.map((v) => [v.vehicle_id, v]))
  );
  const [history, setHistory] = useState<Map<string, RouteHistoryPoint[]>>(() => {
    const m = new Map<string, RouteHistoryPoint[]>();
    for (const p of initialHistory) {
      const arr = m.get(p.route_id) ?? [];
      arr.push(p);
      m.set(p.route_id, arr);
    }
    return m;
  });
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

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

  // Subscribe to Realtime history inserts so sparklines extend live.
  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel("transit_route_history")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transit_route_history" },
        (payload) => {
          const row = payload.new as RouteHistoryPoint;
          const cutoff = Date.now() - HISTORY_WINDOW_MS;
          setHistory((prev) => {
            const next = new Map(prev);
            const arr = next.get(row.route_id) ?? [];
            const trimmed = arr.filter((p) => new Date(p.ts).getTime() >= cutoff);
            trimmed.push(row);
            next.set(row.route_id, trimmed);
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
          <RoutePicker
            routes={routes}
            favorites={favorites}
            history={history}
            onToggle={toggleFavorite}
          />
        </aside>

        <main className="relative flex-1">
          <TransitMap vehicles={visibleVehicles} routeColors={routeColors} />
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
