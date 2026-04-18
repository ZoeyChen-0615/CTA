"use client";

import type { Route } from "@/lib/types";

type Props = {
  routes: Route[];
  favorites: Set<string>;
  onToggle: (routeId: string) => void;
};

export default function RoutePicker({ routes, favorites, onToggle }: Props) {
  const trains = routes.filter((r) => r.mode === "train");
  const buses = routes.filter((r) => r.mode === "bus");

  return (
    <div className="space-y-6">
      <Section title="🚆 Train Lines" routes={trains} favorites={favorites} onToggle={onToggle} />
      <Section title="🚌 Bus Routes" routes={buses} favorites={favorites} onToggle={onToggle} />
    </div>
  );
}

function Section({
  title,
  routes,
  favorites,
  onToggle,
}: {
  title: string;
  routes: Route[];
  favorites: Set<string>;
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
          return (
            <li key={route.route_id}>
              <button
                onClick={() => onToggle(route.route_id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                  active ? "bg-gray-800" : "hover:bg-gray-900"
                }`}
              >
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: route.color }}
                />
                <span className="flex-1 truncate">{route.name}</span>
                <span className={active ? "text-yellow-400" : "text-gray-600"}>
                  {active ? "★" : "☆"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
