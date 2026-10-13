import { API_URL } from "../config";

export type LoginResponse = {
  access_token: string;
  token_type: string;
  role?: string;
};

export async function login(username: string, password: string): Promise<LoginResponse> {
  const body = new URLSearchParams({ username, password }).toString();

  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error("Wrong phone number or password");
    throw new Error(`Server error (${res.status})`);
  }
  return res.json();
}