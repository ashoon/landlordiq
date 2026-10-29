import { getStoredTheme, setStoredTheme } from './store.js'

/** Chart colours per theme (Recharts needs real colour values, not Tailwind classes). Status colours match the palette. */
const CHART_COLORS = {
  light: {
    expected: '#7cc4d0',
    paid: '#22c55e',
    dueSoon: '#fbbf24',
    upcoming: '#94a3b8',
    overdue: '#ef4444',
    vacancy: '#cbd5e1',
    axis: '#475569',
    axisLabel: '#94a3b8',
    tooltipBackground: '#ffffff',
    tooltipBorder: '#e2e8f0',
    tooltipText: '#0f172a',
    categories: { Plumbing: '#0e8ca0', Electrical: '#f59e0b', 'General Repairs': '#10b981', Other: '#94a3b8' },
  },
  dark: {
    expected: '#2a8798',
    paid: '#22c55e',
    dueSoon: '#fbbf24',
    upcoming: '#64748b',
    overdue: '#ef4444',
    vacancy: '#475569',
    axis: '#cbd5e1',
    axisLabel: '#94a3b8',
    tooltipBackground: '#1e2636',
    tooltipBorder: '#2d3748',
    tooltipText: '#f1f5f9',
    categories: { Plumbing: '#38b2c4', Electrical: '#f59e0b', 'General Repairs': '#10b981', Other: '#64748b' },
  },
}

function detectTheme() {
  const stored = getStoredTheme()
  if (stored === 'light' || stored === 'dark') return stored
  const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

function applyTheme(value) {
  if (typeof document !== 'undefined') document.documentElement.classList?.toggle('dark', value === 'dark')
}

let theme = detectTheme()
const listeners = new Set()
applyTheme(theme)

/**
 * The current colour theme, 'light' or 'dark'. The first time the app opens it follows the device setting.
 *
 * @returns {string}
 */
export function getTheme() {
  return theme
}

/**
 * Switches the colour theme, remembers it on this device and tells subscribers to redraw.
 *
 * @param {string} value - 'light' | 'dark'
 */
export function setTheme(value) {
  if (value === theme || (value !== 'light' && value !== 'dark')) return
  theme = value
  setStoredTheme(value)
  applyTheme(value)
  listeners.forEach((listener) => listener())
}

/**
 * Subscribes to theme changes (for useSyncExternalStore).
 *
 * @param {() => void} listener
 * @returns {() => void} unsubscribe
 */
export function subscribeTheme(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Colours for the charts in the current theme.
 *
 * @returns {typeof CHART_COLORS.light}
 */
export function getChartColors() {
  return CHART_COLORS[theme]
}
