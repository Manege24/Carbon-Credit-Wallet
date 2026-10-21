import * as SQLite from "expo-sqlite";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("wallet.db");
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS local_plots (
          plot_id TEXT PRIMARY KEY,
          lat REAL NOT NULL,
          lng REAL NOT NULL,
          radius REAL NOT NULL,
          synced INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS local_batches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          plot_id TEXT NOT NULL,
          tree_count INTEGER NOT NULL,
          species_type TEXT NOT NULL,
          date_planted TEXT NOT NULL,
          synced INTEGER NOT NULL DEFAULT 0
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

export async function savePlotLocally(p: { plot_id: string; lat: number; lng: number; radius: number }) {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO local_plots (plot_id, lat, lng, radius, synced) VALUES (?, ?, ?, ?, 0)",
    [p.plot_id, p.lat, p.lng, p.radius]
  );
}

export async function saveBatchLocally(b: {
  plot_id: string; tree_count: number; species_type: string; date_planted: string;
}) {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO local_batches (plot_id, tree_count, species_type, date_planted, synced) VALUES (?, ?, ?, ?, 0)",
    [b.plot_id, b.tree_count, b.species_type, b.date_planted]
  );
}
export async function countPending(): Promise<number> {
  const db = await getDb();
  const p = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM local_plots WHERE synced = 0");
  const b = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM local_batches WHERE synced = 0");
  return (p?.n ?? 0) + (b?.n ?? 0);
}