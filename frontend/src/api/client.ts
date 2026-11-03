import { API_URL } from "../config";
import {
  getToken,
  saveToken,
  getRefreshToken,
  saveRefreshToken,
  clearToken,
} from "../storage/tokenStore";
import { notifySessionExpired } from "../auth/session";

type RefreshResult = "ok" | "offline" | "rejected";
let refreshing: Promise<RefreshResult> | null = null;

// One shared refresh at a time (refresh tokens are single-use).
async function refreshSession(): Promise<RefreshResult> {
  if (refreshing) return refreshing;
  refreshing = (async (): Promise<RefreshResult> => {
    try {
      const refresh = await getRefreshToken();
      if (!refresh) return "rejected";
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      let res: Response;
      try {
        res = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refresh }),
          signal: controller.signal,
        });
      } catch {
        return "offline";
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) return "rejected";
      const data = await res.json();
      await saveToken(data.access_token);
      if (data.refresh_token) await saveRefreshToken(data.refresh_token);
      return "ok";
    } catch {
      return "offline";
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function send(path: string, options: RequestInit): Promise<Response> {
  const token = await getToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(`${API_URL}${path}`, {
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
}

export async function authFetch(path: string, options: RequestInit = {}) {
  let res = await send(path, options);

  if (res.status === 401) {
    const result = await refreshSession();
    if (result === "ok") {
      res = await send(path, options);
      if (res.status !== 401) return res;
    } else if (result === "offline") {
      throw new Error("Network request failed");
    }
    await clearToken();
    notifySessionExpired();
    throw new Error("Session expired");
  }
  return res;
}