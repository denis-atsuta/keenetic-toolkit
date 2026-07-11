/**
 * Per-router set of policy options hidden from the device selector —
 * the user can trim choices they never use (e.g. "Segment default").
 * Values are the selector values: 'default' | 'segment' | 'deny' | 'p:<id>'.
 */
const hiddenStore = storage.defineItem<Record<string, string[]>>('local:hiddenPolicies', {
  fallback: {},
});

export async function getHiddenPolicies(origin: string): Promise<ReadonlySet<string>> {
  const all = await hiddenStore.getValue();
  return new Set(all[origin] ?? []);
}

export async function toggleHiddenPolicy(
  origin: string,
  value: string,
): Promise<ReadonlySet<string>> {
  const all = await hiddenStore.getValue();
  const next = new Set(all[origin] ?? []);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  await hiddenStore.setValue({ ...all, [origin]: [...next] });
  return next;
}
