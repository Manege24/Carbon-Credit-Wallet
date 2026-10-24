import { authFetch } from "./client";

export type Profile = { farmer_id: string; full_name: string; phone_number: string; county: string };

export async function fetchProfile(): Promise<Profile> {
  const res = await authFetch("/farmers/me");
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}