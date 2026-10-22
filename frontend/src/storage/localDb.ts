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
        CREATE TABLE IF NOT EXISTS kv (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
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

export type LocalPlot = {
  plot_id: string;
  lat: number;
  lng: number;
  radius: number;
  synced: number;
  trees: number;
  batches: number;
};

export async function listPlots(): Promise<LocalPlot[]> {
  const db = await getDb();
  return db.getAllAsync<LocalPlot>(
    `SELECT p.plot_id, p.lat, p.lng, p.radius, p.synced,
            COALESCE(SUM(b.tree_count), 0) AS trees,
            COUNT(b.id) AS batches
     FROM local_plots p
     LEFT JOIN local_batches b ON b.plot_id = p.plot_id
     GROUP BY p.plot_id
     ORDER BY p.rowid DESC`
  );
}

export async function setCache(key: string, value: unknown) {
  const db = await getDb();
  await db.runAsync("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)", [key, JSON.stringify(value)]);
}

export async function getCache<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = ?", [key]);
  return row ? (JSON.parse(row.value) as T) : null;
}