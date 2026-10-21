import * as SecureStore from "expo-secure-store";

const KEY = "jwt_token";

export const saveToken = (token: string) => SecureStore.setItemAsync(KEY, token);
export const getToken = () => SecureStore.getItemAsync(KEY);
export const clearToken = () => SecureStore.deleteItemAsync(KEY);