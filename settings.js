export const DEFAULT_DWELL_SECONDS = 3;
export const DEFAULT_ENABLED = true;
export const DEFAULT_FOCUS_EXISTING = true;
export const DEFAULT_MAX_TABS = 20;
export const MAX_DWELL_SECONDS = 300;
export const MIN_MAX_TABS = 1;
export const MAX_MAX_TABS = 100;

export function normalizeEnabled(value) {
  return typeof value === "boolean" ? value : DEFAULT_ENABLED;
}

export function normalizeFocusExisting(value) {
  return typeof value === "boolean" ? value : DEFAULT_FOCUS_EXISTING;
}

export function normalizeDwellSeconds(value) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return DEFAULT_DWELL_SECONDS;
  return Math.min(MAX_DWELL_SECONDS, Math.max(0, Math.round(number)));
}

export function normalizeMaxTabs(value) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return DEFAULT_MAX_TABS;
  return Math.min(MAX_MAX_TABS, Math.max(MIN_MAX_TABS, Math.round(number)));
}
