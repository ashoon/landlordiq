import { getData, setData } from './store.js'

const pad = (n) => String(n).padStart(2, '0')

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
}

/**
 * The first month the landlord tracks ("YYYY-MM"). Earlier months are hidden from the month
 * picker and the analytics chart; their data is never deleted. Falls back to the current
 * month until ensureTrackingStart() has saved it.
 *
 * @returns {string}
 */
export function getTrackingStart() {
  return getData('settings').trackingStart ?? currentMonthKey()
}

/**
 * Saves the tracking start (the current month) the first time the app runs. Does nothing
 * once a start is saved. No data is changed or removed.
 *
 * @returns {boolean} true when the start was saved just now
 */
export function ensureTrackingStart() {
  const settings = getData('settings')
  if (settings.trackingStart) return false
  setData('settings', { ...settings, trackingStart: currentMonthKey() })
  return true
}
