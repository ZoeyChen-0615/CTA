export type Mode = "train" | "bus";

export type TrackedRoute = {
  route_id: string;
  mode: Mode;
  name: string;
  color: string;
};

export const TRAIN_ROUTES: TrackedRoute[] = [
  { route_id: "Red", mode: "train", name: "Red Line", color: "#C60C30" },
  { route_id: "Blue", mode: "train", name: "Blue Line", color: "#00A1DE" },
  { route_id: "Brn", mode: "train", name: "Brown Line", color: "#62361B" },
  { route_id: "G", mode: "train", name: "Green Line", color: "#009B3A" },
  { route_id: "Org", mode: "train", name: "Orange Line", color: "#F9461C" },
  { route_id: "P", mode: "train", name: "Purple Line", color: "#522398" },
  { route_id: "Pink", mode: "train", name: "Pink Line", color: "#E27EA6" },
  { route_id: "Y", mode: "train", name: "Yellow Line", color: "#F9E300" },
];

// 20 popular CTA bus routes. CTA bus API accepts up to 10 routes per request,
// so the worker chunks this list into two calls per tick.
export const BUS_ROUTES: TrackedRoute[] = [
  { route_id: "3", mode: "bus", name: "#3 King Drive", color: "#2E7D32" },
  { route_id: "4", mode: "bus", name: "#4 Cottage Grove", color: "#2E7D32" },
  { route_id: "6", mode: "bus", name: "#6 Jackson Park Express", color: "#2E7D32" },
  { route_id: "8", mode: "bus", name: "#8 Halsted", color: "#2E7D32" },
  { route_id: "9", mode: "bus", name: "#9 Ashland", color: "#2E7D32" },
  { route_id: "12", mode: "bus", name: "#12 Roosevelt", color: "#2E7D32" },
  { route_id: "20", mode: "bus", name: "#20 Madison", color: "#2E7D32" },
  { route_id: "22", mode: "bus", name: "#22 Clark", color: "#2E7D32" },
  { route_id: "36", mode: "bus", name: "#36 Broadway", color: "#2E7D32" },
  { route_id: "49", mode: "bus", name: "#49 Western", color: "#2E7D32" },
  { route_id: "53", mode: "bus", name: "#53 Pulaski", color: "#2E7D32" },
  { route_id: "63", mode: "bus", name: "#63 63rd", color: "#2E7D32" },
  { route_id: "66", mode: "bus", name: "#66 Chicago", color: "#2E7D32" },
  { route_id: "77", mode: "bus", name: "#77 Belmont", color: "#2E7D32" },
  { route_id: "79", mode: "bus", name: "#79 79th", color: "#2E7D32" },
  { route_id: "81", mode: "bus", name: "#81 Lawrence", color: "#2E7D32" },
  { route_id: "82", mode: "bus", name: "#82 Kimball-Homan", color: "#2E7D32" },
  { route_id: "146", mode: "bus", name: "#146 Inner Drive/Michigan Express", color: "#2E7D32" },
  { route_id: "147", mode: "bus", name: "#147 Outer DuSable Lake Shore Express", color: "#2E7D32" },
  { route_id: "151", mode: "bus", name: "#151 Sheridan", color: "#2E7D32" },
];

export const ALL_ROUTES: TrackedRoute[] = [...TRAIN_ROUTES, ...BUS_ROUTES];

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
