import { getSummaryStats, getUnits, getEditableUnits } from './tenants.js'
import { getData, setData } from './store.js'
import { getTrackingStart } from './tracking.js'
import { t, formatLocaleDate, capitalize } from './i18n.js'
import { withAttachment, withoutAttachment, trashAttachments, trashAttachment } from './attachments.js'

/** Maintenance categories offered when logging an expense (the pie chart's slices). */
export const EXPENSE_CATEGORIES = ['General Repairs', 'Plumbing', 'Electrical', 'Other']

function readExpenses() {
  return getData('expenses')
}

/**
 * Returns the maintenance expenses the user logged for a month, newest first. An expense may be linked
 * to a unit (`unitId`, plus the `address` it had when logged).
 *
 * @param {string} monthKey - "YYYY-MM"
 * @returns {Array<{ id: string, month: string, category: string, amount: number, note: string, unitId?: string, address?: string, attachments?: Array<object> }>}
 */
export function getExpenses(monthKey) {
  // Entries in categories that no longer exist (e.g. HVAC) are ignored
  return readExpenses()
    .filter((e) => e.month === monthKey && EXPENSE_CATEGORIES.includes(e.category))
    .reverse()
}

/**
 * Validates a maintenance expense entry.
 *
 * @param {{ category: string, amount: number|string }} fields
 * @returns {string | null} error message, or null when valid
 */
export function validateExpense(fields) {
  if (!EXPENSE_CATEGORIES.includes(fields.category)) return t('Choose a category.')
  const amount = Number(fields.amount)
  if (!Number.isFinite(amount) || amount <= 0) return t('Amount must be greater than 0.')
  return null
}

/**
 * Units an expense can be linked to, as select options sorted by address. Every label shows the
 * current tenant after the address ("Vacant" when nobody lives there).
 *
 * @returns {Array<{ id: string, label: string }>}
 */
export function getExpenseUnitOptions() {
  return getEditableUnits().map((u) => ({ id: u.id, label: `${u.address} — ${u.vacant ? t('Vacant') : u.tenantName}` }))
}

/** Address an expense belongs to: the unit's current address, else the one saved with the expense, else null. */
function addressOf(expense, addressById) {
  if (!expense.unitId) return null
  return addressById.get(expense.unitId) ?? expense.address ?? null
}

/**
 * Address of a logged expense (null when it isn't linked to a unit).
 *
 * @param {{ unitId?: string, address?: string }} expense
 * @returns {string | null}
 */
export function getExpenseAddress(expense) {
  return addressOf(expense, new Map(getUnits().map((u) => [u.id, u.address])))
}

/**
 * Logs a maintenance expense against a month, so the pie chart and KPIs pick it up. It can optionally be
 * linked to a unit; the unit's address is saved with it so it still reads correctly if the unit is deleted.
 *
 * @param {string} monthKey - "YYYY-MM"
 * @param {{ category: string, amount: number|string, note?: string, unitId?: string }} fields
 * @returns {string} the new expense's id
 */
export function addExpense(monthKey, fields) {
  const expenses = readExpenses()
  const unit = fields.unitId ? getUnits().find((u) => u.id === fields.unitId) : null
  const id = `E${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  expenses.push({
    id,
    month: monthKey,
    category: fields.category,
    amount: Number(fields.amount),
    note: String(fields.note ?? '').trim(),
    ...(unit ? { unitId: unit.id, address: unit.address } : {}),
  })
  setData('expenses', expenses)
  return id
}

/**
 * Maintenance spending per address for a month and for the calendar year it falls in, biggest yearly
 * total first. Expenses not linked to a unit are collected in one last row with `address: null`.
 *
 * @param {string} monthKey - "YYYY-MM"
 * @returns {Array<{ address: string | null, month: number, year: number }>}
 */
export function getMaintenanceByAddress(monthKey) {
  const year = monthKey.slice(0, 4)
  const addressById = new Map(getUnits().map((u) => [u.id, u.address]))
  const rows = new Map()
  for (const e of readExpenses()) {
    if (!EXPENSE_CATEGORIES.includes(e.category) || e.month.slice(0, 4) !== year) continue
    const address = addressOf(e, addressById)
    const row = rows.get(address) ?? { address, month: 0, year: 0 }
    row.year += e.amount
    if (e.month === monthKey) row.month += e.amount
    rows.set(address, row)
  }
  return [...rows.values()].sort((a, b) => {
    if ((a.address === null) !== (b.address === null)) return a.address === null ? 1 : -1
    return b.year - a.year || (a.address ?? '').localeCompare(b.address ?? '')
  })
}

/**
 * Deletes a logged maintenance expense.
 *
 * @param {string} id
 */
export function deleteExpense(id) {
  trashAttachments(readExpenses().find((e) => e.id === id)?.attachments)
  setData('expenses', readExpenses().filter((e) => e.id !== id))
}

/**
 * Attaches a receipt (a file already uploaded to Drive) to a logged maintenance expense.
 *
 * @param {string} id - expense id
 * @param {{ id: string, name: string, mimeType: string, uploadedAt: string }} ref
 */
export function addExpenseFile(id, ref) {
  setData('expenses', readExpenses().map((e) => (e.id === id ? { ...e, attachments: withAttachment(e.attachments, ref) } : e)))
}

/**
 * Removes a receipt from a maintenance expense and moves the Drive file to the trash.
 *
 * @param {string} id - expense id
 * @param {string} fileId - Drive file id
 */
export function removeExpenseFile(id, fileId) {
  setData('expenses', readExpenses().map((e) => (e.id === id ? { ...e, attachments: withoutAttachment(e.attachments, fileId) } : e)))
  trashAttachment(fileId)
}

/**
 * Attaches a receipt (a file already uploaded to Drive) to an annual tax payment.
 *
 * @param {string} id - tax payment id
 * @param {{ id: string, name: string, mimeType: string, uploadedAt: string }} ref
 */
export function addTaxFile(id, ref) {
  setData('taxes', readTaxes().map((x) => (x.id === id ? { ...x, attachments: withAttachment(x.attachments, ref) } : x)))
}

/**
 * Removes a receipt from a tax payment and moves the Drive file to the trash.
 *
 * @param {string} id - tax payment id
 * @param {string} fileId - Drive file id
 */
export function removeTaxFile(id, fileId) {
  setData('taxes', readTaxes().map((x) => (x.id === id ? { ...x, attachments: withoutAttachment(x.attachments, fileId) } : x)))
  trashAttachment(fileId)
}

/** Logged maintenance expenses for a month, totalled by category. */
function maintenanceCostsFor(monthKey) {
  // Built in EXPENSE_CATEGORIES order so the pie chart legend matches the form
  const costs = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0]))
  for (const e of getExpenses(monthKey)) {
    costs[e.category] += e.amount
  }
  return costs
}

function readTaxes() {
  return getData('taxes')
}

/**
 * Returns the recorded annual tax payments, newest tax year first.
 *
 * @returns {Array<{ id: string, year: number, amount: number, paidDate: string, note: string }>}
 */
export function getTaxPayments() {
  return readTaxes().sort((a, b) => b.year - a.year)
}

/**
 * Validates an annual tax payment. Taxes are paid once a year, so each tax year
 * can only be recorded once.
 *
 * @param {{ year: number|string, amount: number|string, paidDate: string }} fields
 * @returns {string | null} error message, or null when valid
 */
export function validateTaxPayment(fields) {
  const year = Number(fields.year)
  const amount = Number(fields.amount)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return t('Enter a valid tax year.')
  if (!Number.isFinite(amount) || amount <= 0) return t('Amount must be greater than 0.')
  if (!fields.paidDate) return t('Date paid is required.')
  if (readTaxes().some((t) => t.year === year)) {
    return t('A {year} tax payment is already recorded. Delete it first to replace it.', { year })
  }
  return null
}

/**
 * Records the annual tax payment. It counts as an expense in the month it was paid
 * (cash basis), so that month's net operating income absorbs the full amount.
 *
 * @param {{ year: number|string, amount: number|string, paidDate: string, note?: string }} fields
 */
export function addTaxPayment(fields) {
  const taxes = readTaxes()
  taxes.push({
    id: `T${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    year: Number(fields.year),
    amount: Number(fields.amount),
    paidDate: fields.paidDate,
    note: String(fields.note ?? '').trim(),
  })
  setData('taxes', taxes)
}

/**
 * Deletes a recorded tax payment.
 *
 * @param {string} id
 */
export function deleteTaxPayment(id) {
  trashAttachments(readTaxes().find((x) => x.id === id)?.attachments)
  setData('taxes', readTaxes().filter((t) => t.id !== id))
}

/** Total tax paid in a calendar month ("YYYY-MM"), by payment date. */
function taxPaidIn(monthKey) {
  return readTaxes()
    .filter((t) => t.paidDate.slice(0, 7) === monthKey)
    .reduce((sum, t) => sum + t.amount, 0)
}

/**
 * Returns financial data for the (up to) 6 months ending at the selected month, never
 * reaching back before the month tracking started.
 * Rent figures are computed live from tenant payment data; maintenance costs are the
 * expenses the user logged for that exact month. `propertyTax` is the annual tax paid
 * in that month (zero in every other month).
 *
 * @param {string} monthKey - selected month, "YYYY-MM"
 * @returns {{ months: Array<Object>, selected: Object }} `selected` is the last entry
 */
export function getFinancials(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)

  const start = getTrackingStart()
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(y, m - 1 - (5 - i), 1)
    return { date, key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` }
  }).filter(({ key }) => key >= start).map(({ date, key }) => {
    const stats = getSummaryStats(key)

    return {
      maintenanceCosts: maintenanceCostsFor(key),
      propertyTax: taxPaidIn(key),
      month: key,
      label: capitalize(formatLocaleDate(date, { month: 'short' })),
      rentExpected: stats.totalExpected,
      rentCollected: stats.totalCollected,
      rentDueSoon: stats.totalDueSoon,
      rentUpcoming: stats.totalUpcoming,
      rentOverdue: stats.totalOverdue,
      vacancyLoss: stats.vacancyLoss,
      vacantUnits: stats.vacant,
      occupancyRate: stats.total ? ((stats.total - stats.vacant) / stats.total) * 100 : 0,
      collectionRate: stats.totalExpected ? (stats.totalCollected / stats.totalExpected) * 100 : 0,
    }
  })

  return { months, selected: months[months.length - 1] }
}
