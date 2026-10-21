import { authFetch } from "./client";

export type ScanItem = {
  plot_id: string;
  scan_date: string;
  ndvi_value: number;
};

export async function fetchHistory(farmerId: string): Promise<ScanItem[]> {
  const res = await authFetch(`/farmers/${farmerId}/verification-history`);
  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}