"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type { Route, Vehicle, VehicleHistoryPoint } from "@/lib/types";
import type { TrailPoint, UserLocation } from "./TransitMap";
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
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [trailsOn, setTrailsOn] = useState(false);
  const [trails, setTrails] = useState<Map<string, TrailPoint[]>>(new Map());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [transitError, setTransitError] = useState<string | null>(null);

  // Subscribe to Realtime vehicle changes.
  useEffect(() => {
    setLastUpdate(new Date());
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
      if (error) {
        setTransitError("Could not update that favorite route.");
      } else {
        setTransitError(null);
      }
    } else {
      const { error } = await supabase
        .from("transit_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("route_id", routeId);
      if (error) {
        setTransitError("Could not update that favorite route.");
      } else {
        setTransitError(null);
      }
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

  const routeModes = useMemo(() => {
    const m = new Map<string, Vehicle["mode"]>();
    for (const r of routes) m.set(r.route_id, r.mode);
    return m;
  }, [routes]);

  const locateUser = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocationError("Location is not supported by this browser.");
      return;
    }

    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        });
        setLocating(false);
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied."
            : "Could not get your location.";
        setLocationError(message);
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30_000,
        timeout: 10_000,
      }
    );
  }, []);

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
        .select("vehicle_id, route_id, lat, lon, recorded_at")
        .in("route_id", routeIds)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        setTransitError("Could not load vehicle trails.");
        return;
      }
      const grouped = new Map<string, TrailPoint[]>();
      for (const p of (data ?? []) as VehicleHistoryPoint[]) {
        const arr = grouped.get(p.vehicle_id) ?? [];
        arr.push({
          routeId: p.route_id,
          lat: Number(p.lat),
          lon: Number(p.lon),
          recordedAt: p.recorded_at,
        });
        grouped.set(p.vehicle_id, arr);
      }
      setTrails(grouped);
      setTransitError(null);
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
              {totalTracked} vehicles tracked · last update{" "}
              {lastUpdate ? lastUpdate.toLocaleTimeString() : "loading"}
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
        {sidebarOpen && (
          <aside className="w-80 shrink-0 overflow-y-auto border-r border-gray-800 bg-gray-950 p-4">
            <RoutePicker routes={routes} favorites={favorites} onToggle={toggleFavorite} />
          </aside>
        )}

        <main className="relative flex-1">
          <TransitMap
            vehicles={visibleVehicles}
            routeColors={routeColors}
            routeModes={routeModes}
            trails={trailsOn ? trails : null}
            userLocation={userLocation}
          />
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className="absolute left-16 top-4 z-[1000] inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900/90 text-gray-100 shadow-lg transition hover:bg-gray-800"
            aria-label={sidebarOpen ? "Collapse route panel" : "Show route panel"}
            title={sidebarOpen ? "Collapse route panel" : "Show route panel"}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {sidebarOpen ? (
                <>
                  <path d="M15 18l-6-6 6-6" />
                  <path d="M20 4v16" />
                </>
              ) : (
                <>
                  <path d="M9 18l6-6-6-6" />
                  <path d="M4 4v16" />
                </>
              )}
            </svg>
          </button>
          <button
            type="button"
            onClick={locateUser}
            disabled={locating}
            className="absolute left-16 top-16 z-[1000] inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900/90 text-gray-100 shadow-lg transition hover:bg-gray-800 disabled:cursor-wait disabled:opacity-70"
            aria-label="Show my location"
            title="Show my location"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className={`h-5 w-5 ${locating ? "animate-pulse" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3" />
              <path d="M12 19v3" />
              <path d="M2 12h3" />
              <path d="M19 12h3" />
              <path d="M18.4 5.6l-2.1 2.1" />
              <path d="M7.7 16.3l-2.1 2.1" />
              <path d="M5.6 5.6l2.1 2.1" />
              <path d="M16.3 16.3l2.1 2.1" />
            </svg>
          </button>
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
          {(locationError || transitError) && (
            <div className="absolute left-16 top-28 z-[1000] max-w-64 rounded-lg bg-gray-900/90 px-3 py-2 text-xs text-gray-100 shadow-lg">
              {locationError ?? transitError}
            </div>
          )}
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
