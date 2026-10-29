/**
 * insights.js — computes per-tenant payment behaviour from the existing payment data.
 *
 * Reads the window of months through getAllTenants(), groups rows by the tenant key
 * (payKey ?? id) so replacement tenants never inherit the previous tenant's record, and
 * returns one entry per tenant who owed rent in the window with late/part-payment counts
 * and the two flags.
 *
 * Nothing is stored or written here.
 */

import { getAllTenants, getMonthKey } from './tenants.js'
import { getTrackingStart } from './tracking.js'

// ─── Rule constants (exported so they are easy to find and change) ───────────

/** Days of grace before a month counts as late. */
export const GRACE_DAYS = 7

/** Maximum number of months looked back (including the current month). */
export const WINDOW_MONTHS = 6

/** Minimum number of late (or part-payment) months required to raise the flag. */
export const FLAG_THRESHOLD = 2

// ─── Internal helpers ────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0')

/**
 * Parses an ISO date string "YYYY-MM-DD" as a local midnight Date.
 * @param {string} iso
 * @returns {Date}
 */
function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Returns today as a local midnight Date.
 * @returns {Date}
 */
function today() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Builds the list of YYYY-MM keys for the window ending at `endMonthKey`, at most
 * WINDOW_MONTHS long and never before the tracking start. Oldest first.
 *
 * @param {string} endMonthKey - "YYYY-MM"
 * @returns {string[]}
 */
function windowMonths(endMonthKey) {
  const [y, m] = endMonthKey.split('-').map(Number)
  const start = getTrackingStart()
  const keys = []
  for (let i = WINDOW_MONTHS - 1; i >= 0; i--) {
    const date = new Date(y, m - 1 - i, 1)
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
    if (key >= start && key <= endMonthKey) keys.push(key)
  }
  return keys
}

/**
 * Returns whether a month has been judged yet: either the full rent is paid, or
 * today is more than GRACE_DAYS past the due date.
 *
 * @param {{ dueDate: string | null, paidCurrentMonth: boolean }} row
 * @returns {boolean}
 */
function isJudged(row) {
  if (!row.dueDate) return false
  if (row.paidCurrentMonth) return true
  const graceEnd = parseDate(row.dueDate)
  graceEnd.setDate(graceEnd.getDate() + GRACE_DAYS)
  return today() > graceEnd
}

/**
 * Returns whether a judged month is late: the rent was not fully paid, or the last payment
 * arrived more than GRACE_DAYS after the due date.
 *
 * @param {{ dueDate: string, paidCurrentMonth: boolean, paidDate: string | null }} row
 * @returns {boolean}
 */
function isLate(row) {
  if (!row.paidCurrentMonth) return true   // unpaid past due + grace = late
  if (!row.paidDate) return false           // legacy: no date — cannot confirm late, treat as on time
  const due = parseDate(row.dueDate)
  const paid = parseDate(row.paidDate)
  const diffDays = Math.round((paid - due) / (1000 * 60 * 60 * 24))
  return diffDays > GRACE_DAYS
}

/**
 * Returns how many days after the due date the payment landed (for late months that
 * have a paidDate). Returns null when the date is unavailable.
 *
 * @param {{ dueDate: string, paidDate: string | null }} row
 * @returns {number | null}
 */
function daysLate(row) {
  if (!row.paidDate) return null
  const due = parseDate(row.dueDate)
  const paid = parseDate(row.paidDate)
  return Math.round((paid - due) / (1000 * 60 * 60 * 24))
}

/**
 * Returns whether a month is a part-payment month: the first dated payment was less than
 * the full rent, or there are payments but the balance is still open.
 * Marking a month paid in one go ("Paid in full") is not a part-payment month.
 *
 * @param {{ paymentLog: Array<{ id: string, amount: number, date: string | null }>, balance: number, rentAmount: number }} row
 * @returns {boolean}
 */
function isPartPayment(row) {
  const log = row.paymentLog ?? []
  if (log.length === 0) return false
  // If paid in full in a single transaction (log length 1, amount === rent, no balance)
  if (log.length === 1 && row.balance === 0 && log[0].amount >= row.rentAmount) return false
  // Any payment received with a balance still open, or first payment was less than rent
  return true
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} TenantInsightEntry
 * @property {string}  unitId        - unit id
 * @property {string}  tenantKey     - payKey ?? id (groups by current tenancy)
 * @property {string}  address       - unit address
 * @property {string | null} tenantName - tenant name (null for vacant, but vacancy rows are skipped)
 * @property {number}  judged        - months judged in the window
 * @property {number}  lateMonths    - of those, how many were late
 * @property {number}  onTimeMonths  - judged minus lateMonths
 * @property {number}  partMonths    - months with part payments
 * @property {number | null} avgDaysLate  - average days late (over late months with a paid date); null when unavailable
 * @property {string | null} worstMonth   - YYYY-MM of the worst (most-days-late) month; null when unavailable
 * @property {number}  balance       - open balance in the current month (0 if fully paid)
 * @property {boolean} paysLate      - true when lateMonths >= FLAG_THRESHOLD
 * @property {boolean} paysInParts   - true when partMonths >= FLAG_THRESHOLD
 */

/**
 * Computes per-tenant payment behaviour for the window ending at `endMonthKey`.
 * Groups rows by tenant key (payKey ?? id) so replacement tenants appear as their
 * own entries. Vacant rows are skipped. Months not yet judged are ignored.
 * Flagged tenants come first; within that group, sorted by most late months then
 * address (natural order).
 *
 * @param {string} [endMonthKey] - "YYYY-MM", defaults to the current month
 * @returns {TenantInsightEntry[]}
 */
export function getTenantInsights(endMonthKey = getMonthKey()) {
  const months = windowMonths(endMonthKey)

  /** @type {Map<string, TenantInsightEntry>} key = tenantKey */
  const map = new Map()

  for (const monthKey of months) {
    const rows = getAllTenants(monthKey)
    for (const row of rows) {
      if (row.status === 'vacant') continue

      const tenantKey = row.payKey ?? row.id

      if (!map.has(tenantKey)) {
        map.set(tenantKey, {
          unitId: row.id,
          tenantKey,
          address: row.address,
          tenantName: row.tenantName,
          judged: 0,
          lateMonths: 0,
          onTimeMonths: 0,
          partMonths: 0,
          _lateDaysList: [],   // internal: collect for avg/worst
          _worstDays: null,    // internal
          _worstMonth: null,   // internal
          balance: 0,
          paysLate: false,
          paysInParts: false,
        })
      }

      const entry = map.get(tenantKey)

      // Always update the balance from the most recent (last in window) month seen
      if (monthKey === endMonthKey) {
        entry.balance = row.balance
      }

      if (!isJudged(row)) continue

      entry.judged += 1

      if (isLate(row)) {
        entry.lateMonths += 1
        const dl = daysLate(row)
        if (dl !== null) {
          entry._lateDaysList.push({ days: dl, month: monthKey })
          if (entry._worstDays === null || dl > entry._worstDays) {
            entry._worstDays = dl
            entry._worstMonth = monthKey
          }
        }
      } else {
        entry.onTimeMonths += 1
      }

      if (isPartPayment(row)) {
        entry.partMonths += 1
      }
    }
  }

  // Finalise entries: compute avgDaysLate, set flags, remove internal fields
  const results = []
  for (const entry of map.values()) {
    const avgDaysLate =
      entry._lateDaysList.length > 0
        ? Math.round(entry._lateDaysList.reduce((s, x) => s + x.days, 0) / entry._lateDaysList.length)
        : null

    results.push({
      unitId: entry.unitId,
      tenantKey: entry.tenantKey,
      address: entry.address,
      tenantName: entry.tenantName,
      judged: entry.judged,
      lateMonths: entry.lateMonths,
      onTimeMonths: entry.onTimeMonths,
      partMonths: entry.partMonths,
      avgDaysLate,
      worstMonth: entry._worstMonth,
      balance: entry.balance,
      paysLate: entry.lateMonths >= FLAG_THRESHOLD,
      paysInParts: entry.partMonths >= FLAG_THRESHOLD,
    })
  }

  // Flagged first, then by most late months, then by address (natural order)
  results.sort((a, b) => {
    const aFlagged = a.paysLate || a.paysInParts ? 0 : 1
    const bFlagged = b.paysLate || b.paysInParts ? 0 : 1
    if (aFlagged !== bFlagged) return aFlagged - bFlagged
    if (b.lateMonths !== a.lateMonths) return b.lateMonths - a.lateMonths
    return a.address.localeCompare(b.address, undefined, { numeric: true, sensitivity: 'base' })
  })

  return results
}

/**
 * Returns a lookup Map from tenantKey → TenantInsightEntry, so the Dashboard can tag
 * each tile without repeating the grouping logic.
 *
 * @param {string} [endMonthKey] - "YYYY-MM", defaults to the current month
 * @returns {Map<string, TenantInsightEntry>}
 */
export function getTenantInsightMap(endMonthKey = getMonthKey()) {
  const entries = getTenantInsights(endMonthKey)
  return new Map(entries.map((e) => [e.tenantKey, e]))
}
