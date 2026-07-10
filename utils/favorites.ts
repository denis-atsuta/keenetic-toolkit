/** Favorite device MACs, kept per router origin. */
const favoritesStore = storage.defineItem<Record<string, string[]>>('local:favorites', {
  fallback: {},
});

export async function getFavorites(origin: string): Promise<Set<string>> {
  const all = await favoritesStore.getValue();
  return new Set(all[origin] ?? []);
}

export async function toggleFavorite(origin: string, mac: string): Promise<Set<string>> {
  const all = await favoritesStore.getValue();
  const current = new Set(all[origin] ?? []);
  if (current.has(mac)) current.delete(mac);
  else current.add(mac);
  await favoritesStore.setValue({ ...all, [origin]: [...current] });
  return current;
}
