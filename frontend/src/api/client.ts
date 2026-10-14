import { API_URL } from "../config";
import { getToken } from "../storage/tokenStore";

export async function authFetch(path: string, options: RequestInit = {}) {
  const token = await getToken();
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
}