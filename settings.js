export const DEFAULT_DWELL_SECONDS = 3;
export const DEFAULT_ENABLED = true;
export const MAX_DWELL_SECONDS = 300;

export function normalizeEnabled(value) {
  return typeof value === "boolean" ? value : DEFAULT_ENABLED;
}

export function normalizeDwellSeconds(value) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return DEFAULT_DWELL_SECONDS;
  return Math.min(MAX_DWELL_SECONDS, Math.max(0, Math.round(number)));
}
