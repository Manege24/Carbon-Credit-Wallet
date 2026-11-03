import { API_URL } from "../config";

export type LoginResponse = {
  access_token: string;
  token_type: string;
  role?: string;
  refresh_token?: string | null;
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

export type RegisterRequest = {
  full_name: string;
  phone_number: string;
  county: string;
  device_id: string;
  password: string;
};

export async function registerFarmer(body: RegisterRequest) {
  const res = await fetch(`${API_URL}/farmers/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 409) throw new Error("This phone number is already registered.");
  if (res.status === 422) throw new Error("Please check your details and try again.");
  if (!res.ok) throw new Error(`Server error (${res.status})`);
  return res.json();
}