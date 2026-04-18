import type { VehicleRow } from "./supabase.js";
import { BUS_ROUTES, TRAIN_ROUTES, chunk } from "./routes.js";

const BUS_ENDPOINT = "https://www.ctabustracker.com/bustime/api/v2/getvehicles";
const TRAIN_ENDPOINT = "https://lapi.transitchicago.com/api/1.0/ttpositions.aspx";

// CTA bus timestamps look like "20260417 17:04" (yyyyMMdd HH:mm, America/Chicago).
function parseBusTimestamp(s: string | undefined): string | null {
  if (!s || s.length < 13) return null;
  const y = s.slice(0, 4);
  const mo = s.slice(4, 6);
  const d = s.slice(6, 8);
  const hm = s.slice(9);
  // Assume America/Chicago (CDT = UTC-5 in April; CST = UTC-6 otherwise).
  // Good enough for "roughly when did the bus report" — the exact offset
  // doesn't affect positional correctness.
  const offset = isChicagoDST(new Date()) ? "-05:00" : "-06:00";
  return `${y}-${mo}-${d}T${hm}:00${offset}`;
}

function isChicagoDST(d: Date): boolean {
  // Simple approximation: DST runs 2nd Sunday of March to 1st Sunday of November.
  const m = d.getUTCMonth();
  if (m > 2 && m < 10) return true;
  if (m < 2 || m > 10) return false;
  return true; // edge months — close enough for a timestamp we don't rely on for logic
}

export async function fetchTrains(apiKey: string): Promise<VehicleRow[]> {
  const rt = TRAIN_ROUTES.map((r) => r.route_id).join(",");
  const url = `${TRAIN_ENDPOINT}?key=${apiKey}&rt=${rt}&outputType=JSON`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Train API ${res.status}: ${await res.text()}`);
  const json: any = await res.json();
  const routes = json?.ctatt?.route ?? [];
  const rows: VehicleRow[] = [];
  for (const routeObj of routes) {
    const route_id: string = routeObj["@name"] ?? routeObj.name ?? "";
    const trains = Array.isArray(routeObj.train) ? routeObj.train : routeObj.train ? [routeObj.train] : [];
    for (const t of trains) {
      const lat = Number(t.lat);
      const lon = Number(t.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      rows.push({
        vehicle_id: `train-${route_id}-${String(t.rn)}`,
        route_id,
        mode: "train",
        lat,
        lon,
        heading: t.heading != null ? Number(t.heading) : null,
        destination: t.destNm ?? null,
        speed: null,
        delayed: String(t.isDly) === "1",
        source_updated_at: t.prdt ? new Date(t.prdt).toISOString() : null,
      });
    }
  }
  return rows;
}

export async function fetchBuses(apiKey: string): Promise<VehicleRow[]> {
  const rows: VehicleRow[] = [];
  for (const group of chunk(BUS_ROUTES, 10)) {
    const rt = group.map((r) => r.route_id).join(",");
    const url = `${BUS_ENDPOINT}?key=${apiKey}&rt=${rt}&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Bus API ${res.status}: ${await res.text()}`);
    const json: any = await res.json();
    const apiErr = json?.["bustime-response"]?.error;
    if (Array.isArray(apiErr) && apiErr.length > 0) {
      // "No data found for parameter" means that route has no active vehicles
      // right now (e.g. late evening, or a route that only runs rush hours).
      // It's per-route, not fatal — only throw on real errors like a bad key.
      const realErrors = apiErr.filter((e: any) => {
        const msg = String(e?.msg ?? "").toLowerCase();
        return !msg.includes("no data found for parameter");
      });
      if (realErrors.length > 0) {
        throw new Error(`Bus API error: ${realErrors.map((e: any) => e?.msg ?? JSON.stringify(e)).join("; ")}`);
      }
    }
    const vehicles = json?.["bustime-response"]?.vehicle ?? [];
    for (const v of vehicles) {
      const lat = Number(v.lat);
      const lon = Number(v.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      rows.push({
        vehicle_id: `bus-${String(v.vid)}`,
        route_id: String(v.rt),
        mode: "bus",
        lat,
        lon,
        heading: v.hdg != null ? Number(v.hdg) : null,
        destination: v.des ?? null,
        speed: v.spd != null ? Number(v.spd) : null,
        delayed: v.dly === true || v.dly === "true",
        source_updated_at: parseBusTimestamp(v.tmstmp),
      });
    }
  }
  return rows;
}
