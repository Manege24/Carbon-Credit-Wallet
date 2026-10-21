import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const KEY = "device_id";

export async function getDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync(KEY, id);
  }
  return id;
}