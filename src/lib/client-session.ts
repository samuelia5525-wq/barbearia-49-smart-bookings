const KEY = "b49_client";

export type ClientSession = { name: string; phone: string; nickname?: string | null };

export function loadClient(): ClientSession | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(KEY);
    return v ? (JSON.parse(v) as ClientSession) : null;
  } catch {
    return null;
  }
}
export function saveClient(c: ClientSession) {
  localStorage.setItem(KEY, JSON.stringify(c));
}
export function clearClient() {
  localStorage.removeItem(KEY);
}
