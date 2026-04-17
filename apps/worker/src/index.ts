import "dotenv/config";
import { makeServiceClient, type VehicleRow } from "./supabase.js";
import { fetchBuses, fetchTrains } from "./cta.js";

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 20_000);
const STALE_AFTER_MINUTES = 10;

const supabase = makeServiceClient();

async function tick(): Promise<void> {
  const started = Date.now();
  const results = await Promise.allSettled([
    process.env.TRAIN_API_KEY ? fetchTrains(process.env.TRAIN_API_KEY) : Promise.resolve([]),
    process.env.BUSTIME_API_KEY ? fetchBuses(process.env.BUSTIME_API_KEY) : Promise.resolve([]),
  ]);

  const rows: VehicleRow[] = [];
  const errors: string[] = [];
  for (const [i, r] of results.entries()) {
    const label = i === 0 ? "trains" : "buses";
    if (r.status === "fulfilled") rows.push(...r.value);
    else errors.push(`${label}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("vehicles").upsert(rows, { onConflict: "vehicle_id" });
    if (error) errors.push(`upsert: ${error.message}`);
  }

  const cutoff = new Date(Date.now() - STALE_AFTER_MINUTES * 60_000).toISOString();
  const { error: pruneErr } = await supabase.from("vehicles").delete().lt("updated_at", cutoff);
  if (pruneErr) errors.push(`prune: ${pruneErr.message}`);

  const ms = Date.now() - started;
  if (errors.length) {
    console.error(`[tick ${new Date().toISOString()}] ${rows.length} rows in ${ms}ms — ERRORS: ${errors.join(" | ")}`);
  } else {
    console.log(`[tick ${new Date().toISOString()}] ${rows.length} rows in ${ms}ms`);
  }
}

async function main(): Promise<void> {
  console.log(
    `Transit Tracker worker starting — polling every ${POLL_INTERVAL_MS}ms ` +
      `(trains=${!!process.env.TRAIN_API_KEY}, buses=${!!process.env.BUSTIME_API_KEY})`
  );
  await tick();
  setInterval(() => {
    tick().catch((err) => console.error("[tick] uncaught:", err));
  }, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
