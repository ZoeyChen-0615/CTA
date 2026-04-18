"use client";

import type { Route, RouteHistoryPoint } from "@/lib/types";
import Sparkline from "./Sparkline";

type Props = {
  routes: Route[];
  favorites: Set<string>;
  history: Map<string, RouteHistoryPoint[]>;
  onToggle: (routeId: string) => void;
};

export default function RoutePicker({ routes, favorites, history, onToggle }: Props) {
  const trains = routes.filter((r) => r.mode === "train");
  const buses = routes.filter((r) => r.mode === "bus");

  return (
    <div className="space-y-6">
      <Section
        title="🚆 Train Lines"
        routes={trains}
        favorites={favorites}
        history={history}
        onToggle={onToggle}
      />
      <Section
        title="🚌 Bus Routes"
        routes={buses}
        favorites={favorites}
        history={history}
        onToggle={onToggle}
      />
    </div>
  );
}

function Section({
  title,
  routes,
  favorites,
  history,
  onToggle,
}: {
  title: string;
  routes: Route[];
  favorites: Set<string>;
  history: Map<string, RouteHistoryPoint[]>;
  onToggle: (routeId: string) => void;
}) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h2>
      <ul className="space-y-1">
        {routes.map((route) => {
          const active = favorites.has(route.route_id);
          const points = (history.get(route.route_id) ?? []).map((p) => p.vehicle_count);
          const current = points.length > 0 ? points[points.length - 1] : 0;
          return (
            <li key={route.route_id}>
              <button
                onClick={() => onToggle(route.route_id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                  active ? "bg-gray-800" : "hover:bg-gray-900"
                }`}
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: route.color }}
                />
                <span className="flex-1 truncate">{route.name}</span>
                <span className="flex items-center gap-2">
                  <Sparkline points={points} color={route.color} />
                  <span className="w-6 text-right text-xs tabular-nums text-gray-400">
                    {current}
                  </span>
                  <span className={active ? "text-yellow-400" : "text-gray-600"}>
                    {active ? "★" : "☆"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
