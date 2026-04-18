export type Route = {
  route_id: string;
  mode: "train" | "bus";
  name: string;
  color: string;
};

export type Vehicle = {
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
  updated_at: string;
};

export type RouteHistoryPoint = {
  route_id: string;
  ts: string;
  vehicle_count: number;
};
