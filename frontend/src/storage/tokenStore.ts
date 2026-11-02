import * as SecureStore from "expo-secure-store";

const KEY = "jwt_token";
const REFRESH_KEY = "refresh_token";

export const saveToken = (token: string) => SecureStore.setItemAsync(KEY, token);
export const getToken = () => SecureStore.getItemAsync(KEY);

export const saveRefreshToken = (token: string) => SecureStore.setItemAsync(REFRESH_KEY, token);
export const getRefreshToken = () => SecureStore.getItemAsync(REFRESH_KEY);

export async function clearToken() {
  await SecureStore.deleteItemAsync(KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}