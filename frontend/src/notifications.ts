import { ScanItem } from "./api/history";
import { getCache, setCache } from "./storage/localDb";

export type Notice = {
  id: string;
  date: string;
  title: string;
  body: string;
  kind: "good" | "warn" | "bad" | "info";
};

export function buildNotices(items: ScanItem[]): Notice[] {
  const notices: Notice[] = [];
  for (const s of items) {
    const plot = `Plot ...${s.plot_id.slice(-4)}`;
    const id = `${s.plot_id}|${s.scan_date}`;
    if (s.outcome === "verified" && s.tokens_issued_kg > 0) {
      notices.push({ id, date: s.scan_date, kind: "good", title: "Credits issued",
        body: `${plot} was verified. +${s.tokens_issued_kg} kg CO₂ added to your balance.` });
    } else if (s.outcome === "verified") {
      notices.push({ id, date: s.scan_date, kind: "info", title: "Plot verified",
        body: `${plot} looks healthy. No new credits were issued.` });
    } else if (s.outcome === "withheld") {
      notices.push({ id, date: s.scan_date, kind: "warn", title: "Credits on hold",
        body: `${plot} showed a drop in tree health. We will check again at the next scan.` });
    } else if (s.outcome === "degraded") {
      notices.push({ id, date: s.scan_date, kind: "bad", title: "Plot flagged",
        body: `${plot} declined over consecutive scans.${s.tokens_revoked_kg ? ` ${s.tokens_revoked_kg} kg of unsold credits were revoked.` : ""}` });
    }
  }
  return notices.sort((a, b) => b.date.localeCompare(a.date));
}

export async function saveNotices(n: Notice[]) {
  await setCache("notices", n);
}

export async function loadNotices(): Promise<Notice[]> {
  return (await getCache<Notice[]>("notices")) ?? [];
}

export async function getSeen(): Promise<string[]> {
  return (await getCache<string[]>("notices_seen")) ?? [];
}

export async function markAllSeen(n: Notice[]) {
  await setCache("notices_seen", n.map((x) => x.id));
}

export async function unreadCount(): Promise<number> {
  const [n, seen] = await Promise.all([loadNotices(), getSeen()]);
  return n.filter((x) => !seen.includes(x.id)).length;
}