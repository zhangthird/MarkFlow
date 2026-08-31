export const PANEL_PREFERENCE_KEYS = {
  explorerOpen: 'markflow.explorer.open',
  explorerWidth: 'markflow.explorer.width',
  backlinksOpen: 'markflow.backlinks.open',
  backlinksWidth: 'markflow.backlinks.width',
} as const

export const DEFAULT_EXPLORER_WIDTH = 260
export const MIN_EXPLORER_WIDTH = 200
export const MAX_EXPLORER_WIDTH = 420

export const DEFAULT_BACKLINKS_WIDTH = 304
export const MIN_BACKLINKS_WIDTH = 260
export const MAX_BACKLINKS_WIDTH = 420

export function clampPanelWidth(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function parseStoredPanelWidth(
  rawValue: string | null,
  min: number,
  max: number,
  fallback: number
): number {
  if (rawValue === null || rawValue.trim() === '') return fallback
  return clampPanelWidth(Number(rawValue), min, max, fallback)
}

export function parseStoredBoolean(rawValue: string | null, fallback: boolean): boolean {
  if (rawValue === 'true') return true
  if (rawValue === 'false') return false
  return fallback
}
