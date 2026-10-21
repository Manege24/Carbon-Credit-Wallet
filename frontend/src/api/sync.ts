import { authFetch } from "./client";
import { createBatch } from "./batches";
import { getDb } from "../storage/localDb";

let running = false;

export async function syncAll() {
  if (running) throw new Error("Sync already running");
  running = true;
  try {
    const db = await getDb();

    // 1. plots first
    const plots = await db.getAllAsync<{ plot_id: string; lat: number; lng: number; radius: number }>(
      "SELECT plot_id, lat, lng, radius FROM local_plots WHERE synced = 0"
    );
    if (plots.length > 0) {
      const res = await authFetch("/sync/plots", {
        method: "POST",
        body: JSON.stringify(
          plots.map((p) => ({
            plot_id: p.plot_id,
            centroid_lat: p.lat,
            centroid_lng: p.lng,
            radius_m: p.radius,
          }))
        ),
      });
      if (!res.ok) throw new Error(`Sync error ${res.status}: ${await res.text()}`);
      for (const p of plots) {
        await db.runAsync("UPDATE local_plots SET synced = 1 WHERE plot_id = ?", [p.plot_id]);
      }
    }

    // 2. then batches whose plot is already on the server
    const batches = await db.getAllAsync<{
      id: number; plot_id: string; tree_count: number; species_type: string; date_planted: string;
    }>(
      `SELECT b.id, b.plot_id, b.tree_count, b.species_type, b.date_planted
       FROM local_batches b JOIN local_plots p ON p.plot_id = b.plot_id
       WHERE b.synced = 0 AND p.synced = 1`
    );
    for (const b of batches) {
      await createBatch(b.plot_id, {
        tree_count: b.tree_count,
        species_type: b.species_type,
        date_planted: b.date_planted,
      });
      await db.runAsync("UPDATE local_batches SET synced = 1 WHERE id = ?", [b.id]);
    }
  } finally {
    running = false;
  }
}