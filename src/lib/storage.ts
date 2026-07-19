export function readStorageValue<T>(key: string, fallback: T): T {
  const value = localStorage.getItem(key);
  if (value === null) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

export function writeStorageValue(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function toggleId(ids: Set<string>, id: string): Set<string> {
  const nextIds = new Set(ids);
  if (nextIds.has(id)) nextIds.delete(id);
  else nextIds.add(id);
  return nextIds;
}
