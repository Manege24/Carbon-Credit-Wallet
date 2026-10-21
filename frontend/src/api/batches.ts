import { authFetch } from "./client";

export type BatchRequest = {
  tree_count: number;
  species_type: string;
  date_planted: string; // YYYY-MM-DD
};

export async function createBatch(plotId: string, batch: BatchRequest) {
  const res = await authFetch(`/plots/${plotId}/batches`, {
    method: "POST",
    body: JSON.stringify(batch),
  });
  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}