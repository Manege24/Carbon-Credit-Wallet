import { API_URL } from "../config";
import { getToken } from "../storage/tokenStore";

export async function authFetch(path: string, options: RequestInit = {}) {
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