/**
 * paymentHistory.js — everything one tenant has paid, month by month.
 *
 * Reads each month through getAllTenants() (the same rows the dashboard shows), keeps the months in which the
 * chosen tenant owed rent, and adds the days between the due date and the date the rent was paid. Months
 * before the tracking start are hidden, as everywhere else in the app; nothing is stored or written here.
 */

import { getAllTenants, getAvailableMonths, getMonthKey, getTodayIso } from './tenants.js'

/** Key that identifies one tenant's stay in a unit: payKey for replacement tenants, else the unit id. */
const tenantKeyOf = (row) => row.payKey ?? row.id

function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Whole days from `fromIso` to `toIso` (positive when `toIso` is later). */
function daysBetween(fromIso, toIso) {
  return Math.round((parseDate(toIso) - parseDate(fromIso)) / (1000 * 60 * 60 * 24))
}

/** Months to look at, oldest first: from the tracking start through next month (early payments). */
function monthsOldestFirst() {
  return getAvailableMonths().map((m) => m.value).reverse()
}

/**
 * Tenants that can be picked for the history: everyone who owed rent in a tracked month, current tenants first,
 * then by address. A tenant who has moved out is marked `former`.
 *
 * @returns {Array<{ key: string, address: string, tenantName: string, former: boolean }>}
 */
export function getHistoryTenants() {
  const current = new Set(
    getAllTenants(getMonthKey())
      .filter((r) => r.status !== 'vacant')
      .map(tenantKeyOf),
  )
  const found = new Map()
  for (const month of monthsOldestFirst()) {
    for (const row of getAllTenants(month)) {
      if (row.status === 'vacant') continue
      // Later months overwrite earlier ones, so an edited name or address shows its latest value
      found.set(tenantKeyOf(row), { key: tenantKeyOf(row), address: row.address, tenantName: row.tenantName, former: !current.has(tenantKeyOf(row)) })
    }
  }
  return [...found.values()].sort(
    (a, b) =>
      Number(a.former) - Number(b.former) ||
      a.address.localeCompare(b.address, undefined, { numeric: true, sensitivity: 'base' }) ||
      a.tenantName.localeCompare(b.tenantName),
  )
}

/**
 * @typedef {Object} HistoryRow
 * @property {string} month - "YYYY-MM"
 * @property {string} dueDate - ISO date (an edited due date counts)
 * @property {number} rentAmount
 * @property {number} amountPaid
 * @property {number} balance
 * @property {'paid'|'due-soon'|'upcoming'|'overdue'} status
 * @property {Array<{ id: string, amount: number, date: string | null }>} payments - dated payments received (a month paid in one go shows one entry)
 * @property {number | null} daysFromDue - paid date minus due date (negative = early); null until paid in full
 */

/**
 * Month-by-month payment history of one tenant, newest month first, with totals. The months counted are those up
 * to the current month; next month is listed only when something was already paid for it.
 *
 * @param {string} tenantKey - `key` from getHistoryTenants()
 * @returns {{ rows: HistoryRow[], totals: { months: number, expected: number, paid: number, owed: number, lateMonths: number } }}
 */
export function getPaymentHistory(tenantKey) {
  const thisMonth = getMonthKey()
  const rows = []

  for (const month of monthsOldestFirst()) {
    const row = getAllTenants(month).find((r) => r.status !== 'vacant' && tenantKeyOf(r) === tenantKey)
    if (!row) continue
    if (month > thisMonth && row.amountPaid <= 0) continue

    const payments = row.paymentLog.length
      ? row.paymentLog
      : row.paidCurrentMonth && row.paidDate
        ? [{ id: `${month}-paid`, amount: row.rentAmount, date: row.paidDate }]
        : []
    rows.push({
      month,
      dueDate: row.dueDate,
      rentAmount: row.rentAmount,
      amountPaid: row.amountPaid,
      balance: row.balance,
      status: row.status,
      payments,
      daysFromDue: row.paidCurrentMonth && row.paidDate ? daysBetween(row.dueDate, row.paidDate) : null,
    })
  }

  const counted = rows.filter((r) => r.month <= thisMonth)
  const today = getTodayIso()
  const totals = {
    months: counted.length,
    expected: counted.reduce((sum, r) => sum + r.rentAmount, 0),
    paid: rows.reduce((sum, r) => sum + r.amountPaid, 0),
    // Only rent that is already past its due date counts as owed
    owed: counted.filter((r) => r.dueDate < today).reduce((sum, r) => sum + r.balance, 0),
    lateMonths: counted.filter((r) => r.daysFromDue !== null && r.daysFromDue > 0).length,
  }
  return { rows: rows.reverse(), totals }
}
