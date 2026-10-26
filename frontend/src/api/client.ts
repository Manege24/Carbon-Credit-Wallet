import { API_URL } from "../config";
import { getToken, clearToken } from "../storage/tokenStore";
import { notifySessionExpired } from "../auth/session";

export async function authFetch(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
    });
  } catch {
    throw new Error("Network request failed");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) {
    await clearToken();
    notifySessionExpired();
    throw new Error("Session expired");
  }
  return res;
}