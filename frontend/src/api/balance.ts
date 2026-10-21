import { authFetch } from "./client";

export async function fetchBalance(farmerId: string) {
  const res = await authFetch(`/farmers/${farmerId}/balance`);
  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}