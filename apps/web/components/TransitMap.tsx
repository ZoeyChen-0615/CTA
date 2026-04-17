"use client";

import { useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import type { Vehicle } from "@/lib/types";

// Chicago Loop
const CHICAGO_CENTER: [number, number] = [41.8781, -87.6298];

type Props = {
  vehicles: Vehicle[];
  routeColors: Map<string, string>;
};

function buildIcon(color: string, mode: "train" | "bus", heading: number | null) {
  const isTrain = mode === "train";
  const shape = isTrain
    ? `width:14px;height:14px;border-radius:4px;`
    : `width:16px;height:16px;border-radius:50%;`;
  const arrow =
    heading != null
      ? `<div style="position:absolute;top:-7px;left:50%;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:6px solid ${color};transform:translateX(-50%) rotate(${heading}deg);transform-origin:50% 13px;"></div>`
      : "";
  return L.divIcon({
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<div style="position:relative;${shape}background:${color};border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.5);">${arrow}</div>`,
  });
}

export default function TransitMap({ vehicles, routeColors }: Props) {
  // Pre-compute an icon per (route, heading rounded) combo. Rotations change
  // often so this cache keys on both.
  const icons = useMemo(() => {
    const cache = new Map<string, L.DivIcon>();
    return (v: Vehicle) => {
      const color = routeColors.get(v.route_id) ?? "#999";
      const headingKey = v.heading == null ? "n" : String(Math.round(v.heading / 15) * 15);
      const key = `${v.mode}-${color}-${headingKey}`;
      let icon = cache.get(key);
      if (!icon) {
        icon = buildIcon(color, v.mode, v.heading);
        cache.set(key, icon);
      }
      return icon;
    };
  }, [routeColors]);

  return (
    <MapContainer
      center={CHICAGO_CENTER}
      zoom={12}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {vehicles.map((v) => (
        <Marker key={v.vehicle_id} position={[v.lat, v.lon]} icon={icons(v)}>
          <Popup>
            <div style={{ color: "#111" }}>
              <div style={{ fontWeight: 600 }}>
                {v.mode === "train" ? "🚆" : "🚌"} Route {v.route_id}
              </div>
              {v.destination && <div>→ {v.destination}</div>}
              {v.speed != null && <div>{Math.round(v.speed)} mph</div>}
              {v.delayed && <div style={{ color: "#c00" }}>⚠ delayed</div>}
              <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                {new Date(v.updated_at).toLocaleTimeString()}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
