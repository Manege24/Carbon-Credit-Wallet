import { authFetch } from "./client";

export type PlotRequest = {
  centroid_lat: number;
  centroid_lng: number;
  radius_m: number;
};

export async function createPlot(plot: PlotRequest) {
  const res = await authFetch("/plots", {
    method: "POST",
    body: JSON.stringify(plot),
  });
  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}