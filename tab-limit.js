export function pickTabsToClose(tabs, { maxTabs, keepIds }) {
  const excess = tabs.length - maxTabs;
  if (excess <= 0) return [];
  const keep = keepIds instanceof Set ? keepIds : new Set(keepIds);
  return tabs
    .filter((tab) => tab.id != null && !keep.has(tab.id) && !tab.pinned)
    .sort((a, b) => b.index - a.index)
    .slice(0, excess)
    .map((tab) => tab.id);
}
