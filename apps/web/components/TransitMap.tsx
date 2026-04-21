"use client";

import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { Vehicle } from "@/lib/types";

// Chicago Loop
const CHICAGO_CENTER: [number, number] = [41.8781, -87.6298];

type Props = {
  vehicles: Vehicle[];
  routeColors: Map<string, string>;
  routeModes: Map<string, Vehicle["mode"]>;
  trails: Map<string, TrailPoint[]> | null;
  userLocation: UserLocation | null;
};

export type TrailPoint = {
  routeId: string;
  lat: number;
  lon: number;
  recordedAt: string;
};

export type UserLocation = {
  lat: number;
  lon: number;
  accuracy: number | null;
};

const MAX_TRAIL_GAP_MS = 3 * 60_000;
const MAX_TRAIN_MPH = 80;
const MAX_BUS_MPH = 55;
const MIN_ALLOWED_SEGMENT_MILES = 0.35;
const MAX_ALLOWED_SEGMENT_MILES = 2;

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

function distanceMiles(a: TrailPoint, b: TrailPoint) {
  const earthRadiusMiles = 3958.8;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(h));
}

function splitTrail(points: TrailPoint[], mode: Vehicle["mode"]) {
  const segments: [number, number][][] = [];
  let current: [number, number][] = [];
  const maxMph = mode === "train" ? MAX_TRAIN_MPH : MAX_BUS_MPH;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const previous = index > 0 ? points[index - 1] : null;
    let shouldStartNewSegment = false;

    if (previous) {
      const gapMs = new Date(point.recordedAt).getTime() - new Date(previous.recordedAt).getTime();
      const maxDistanceForGap = Math.min(
        MAX_ALLOWED_SEGMENT_MILES,
        Math.max(MIN_ALLOWED_SEGMENT_MILES, (maxMph * Math.max(gapMs, 0)) / 3_600_000)
      );
      shouldStartNewSegment =
        gapMs > MAX_TRAIL_GAP_MS || distanceMiles(previous, point) > maxDistanceForGap;
    }

    if (shouldStartNewSegment) {
      if (current.length >= 2) segments.push(current);
      current = [];
    }

    current.push([point.lat, point.lon]);
  }

  if (current.length >= 2) segments.push(current);
  return segments;
}

const userLocationIcon = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 0 2px rgba(37,99,235,0.35),0 4px 12px rgba(0,0,0,0.35);"></div>`,
});

function UserLocationLayer({ location }: { location: UserLocation | null }) {
  const map = useMap();

  useEffect(() => {
    if (!location) return;
    map.flyTo([location.lat, location.lon], Math.max(map.getZoom(), 15), {
      duration: 0.8,
    });
  }, [location, map]);

  if (!location) return null;

  const position: [number, number] = [location.lat, location.lon];

  return (
    <>
      {location.accuracy != null && (
        <Circle
          center={position}
          radius={location.accuracy}
          pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.12, weight: 1 }}
        />
      )}
      <Marker position={position} icon={userLocationIcon}>
        <Popup>
          <div style={{ color: "#111" }}>
            <div style={{ fontWeight: 600 }}>Your location</div>
            {location.accuracy != null && (
              <div style={{ fontSize: 12, color: "#555" }}>
                Accuracy: about {Math.round(location.accuracy)} m
              </div>
            )}
          </div>
        </Popup>
      </Marker>
    </>
  );
}

export default function TransitMap({
  vehicles,
  routeColors,
  routeModes,
  trails,
  userLocation,
}: Props) {
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

  const trailEntries = useMemo(() => {
    if (!trails) return [];
    const out: {
      key: string;
      positions: [number, number][];
      color: string;
    }[] = [];
    for (const [vehicleId, points] of trails) {
      if (!points || points.length < 2) continue;
      const routeId = points[0]?.routeId;
      if (!routeId) continue;
      const color = routeColors.get(routeId) ?? "#999";
      const mode = routeModes.get(routeId) ?? "bus";
      splitTrail(points, mode).forEach((positions, index) => {
        out.push({
          key: `${vehicleId}-${index}`,
          positions,
          color,
        });
      });
    }
    return out;
  }, [trails, routeColors, routeModes]);

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
      <UserLocationLayer location={userLocation} />
      {trailEntries.map((t) => (
        <Polyline
          key={`trail-${t.key}`}
          positions={t.positions}
          pathOptions={{ color: t.color, weight: 3, opacity: 0.55 }}
        />
      ))}
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
