/**
 * loans.js — data access and monthly installment tracking for loans given to individuals.
 *
 * Loans represent money lent out (principal/capital) that yields a monthly payment (interest
 * or installment) due on a specific day of each month until the principal is repaid.
 * Active loans generate monthly payment rows alongside rental units on the dashboard.
 */
import { getData, setData } from './store.js'
import {
  toIso,
  getTodayIso,
  getMonthKey,
  getStatusForTenant,
  getPriorTrackedMonths,
  daysCoveredBy,
  validateDate,
} from './tenants.js'
import { t } from './i18n.js'

/**
 * Returns all stored loans, newest first.
 *
 * @returns {Array<{
 *   id: string,
 *   borrowerName: string,
 *   phone: string,
 *   principalAmount: number,
 *   monthlyAmount: number,
 *   dueDay: number,
 *   startDate: string,
 *   capitalDueDate: string,
 *   note: string,
 *   status: 'active' | 'settled'
 * }>}
 */
export function getLoans() {
  const loans = getData('loans')
  return Array.isArray(loans) ? loans : []
}

/**
 * Returns active loans only.
 */
export function getActiveLoans() {
  return getLoans().filter((loan) => (loan.status ?? 'active') === 'active')
}

/**
 * Validates loan form inputs.
 *
 * @param {{
 *   borrowerName?: string,
 *   principalAmount?: number,
 *   monthlyAmount?: number,
 *   dueDay?: number,
 *   startDate?: string,
 *   capitalDueDate?: string
 * }} fields
 * @returns {string | null} error message, or null when valid
 */
export function validateLoan(fields) {
  if (!fields.borrowerName?.trim()) return t('Enter the borrower name.')
  if (!Number.isFinite(fields.principalAmount) || fields.principalAmount <= 0) {
    return t('Enter a valid principal / capital amount.')
  }
  if (!Number.isFinite(fields.monthlyAmount) || fields.monthlyAmount <= 0) {
    return t('Enter a valid monthly payment amount.')
  }
  const day = Number(fields.dueDay)
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return t('Enter a valid due day (1–31).')
  }
  if (fields.startDate && validateDate(fields.startDate)) {
    return t('Enter a valid loan start date.')
  }
  if (fields.capitalDueDate && validateDate(fields.capitalDueDate)) {
    return t('Enter a valid capital due date.')
  }
  return null
}

/**
 * Adds a new loan.
 *
 * @param {{
 *   borrowerName: string,
 *   phone?: string,
 *   principalAmount: number,
 *   monthlyAmount: number,
 *   dueDay?: number,
 *   startDate?: string,
 *   capitalDueDate?: string,
 *   note?: string
 * }} fields
 * @returns {Object} the newly created loan
 */
export function addLoan(fields) {
  const error = validateLoan(fields)
  if (error) throw new Error(error)

  const loans = getLoans()
  const newLoan = {
    id: `L${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    borrowerName: fields.borrowerName.trim(),
    phone: fields.phone?.trim() ?? '',
    principalAmount: Math.round(fields.principalAmount),
    monthlyAmount: Math.round(fields.monthlyAmount),
    dueDay: Number(fields.dueDay ?? 30),
    startDate: fields.startDate?.trim() || getTodayIso(),
    capitalDueDate: fields.capitalDueDate?.trim() || '',
    note: fields.note?.trim() ?? '',
    status: 'active',
  }
  setData('loans', [newLoan, ...loans])
  return newLoan
}

/**
 * Updates an existing loan.
 *
 * @param {string} id
 * @param {Object} patch
 */
export function updateLoan(id, patch) {
  const loans = getLoans()
  const current = loans.find((l) => l.id === id)
  if (!current) return

  const merged = { ...current, ...patch }
  const error = validateLoan(merged)
  if (error) throw new Error(error)

  setData(
    'loans',
    loans.map((l) =>
      l.id === id
        ? {
            ...merged,
            borrowerName: merged.borrowerName.trim(),
            phone: merged.phone?.trim() ?? '',
            principalAmount: Math.round(merged.principalAmount),
            monthlyAmount: Math.round(merged.monthlyAmount),
            dueDay: Number(merged.dueDay),
            startDate: merged.startDate?.trim() || getTodayIso(),
            capitalDueDate: merged.capitalDueDate?.trim() || '',
            note: merged.note?.trim() ?? '',
          }
        : l,
    ),
  )
}

/**
 * Deletes a loan by ID.
 *
 * @param {string} id
 */
export function deleteLoan(id) {
  setData(
    'loans',
    getLoans().filter((l) => l.id !== id),
  )
}

/**
 * Settles a loan (marks capital/principal as fully repaid).
 *
 * @param {string} id
 */
export function settleLoan(id) {
  const loans = getLoans()
  setData(
    'loans',
    loans.map((l) => (l.id === id ? { ...l, status: 'settled' } : l)),
  )
}

/**
 * Re-activates a settled loan.
 *
 * @param {string} id
 */
export function reactivateLoan(id) {
  const loans = getLoans()
  setData(
    'loans',
    loans.map((l) => (l.id === id ? { ...l, status: 'active' } : l)),
  )
}

/** Key under which a loan's monthly payment is stored. */
function loanPaymentKey(loanId, monthKey) {
  return `${monthKey}:loan:${loanId}`
}

/** Reads stored payment record for a loan in a given month. */
function readLoanPayment(overrides, loanId, monthKey) {
  const val = overrides[loanPaymentKey(loanId, monthKey)]
  if (val === undefined) return null
  if (typeof val === 'boolean') {
    return { paid: val, paidDate: val ? toIso(new Date()) : null }
  }
  return val
}

function loanPaymentEntries(override) {
  if (override?.payments?.length) {
    return [...override.payments].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  }
  return override?.amountPaid > 0 ? [{ id: 'legacy', amount: override.amountPaid, date: null }] : []
}

/**
 * Builds the monthly installment due date for a loan in the given month.
 */
function getLoanDueDate(loan, monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const day = loan.dueDay >= 30 ? lastDay : Math.min(loan.dueDay, lastDay)
  return toIso(new Date(y, m - 1, day))
}

/**
 * Calculates prior unpaid months and total arrears for a loan across prior tracked months.
 */
function getPriorUnpaidForLoan(loan, priorMonths, overrides) {
  if (priorMonths.length === 0) return { priorArrears: 0, priorUnpaidMonths: [] }
  const unpaidMonths = []
  let totalArrears = 0
  const loanStartMonth = loan.startDate ? loan.startDate.slice(0, 7) : ''

  for (const mKey of priorMonths) {
    if (loanStartMonth && mKey < loanStartMonth) continue

    const override = readLoanPayment(overrides, loan.id, mKey)
    const paid = override?.paid ?? false
    if (paid) continue

    const entries = loanPaymentEntries(override)
    const received = entries.reduce((sum, p) => sum + p.amount, 0)
    const amountPaid = Math.min(received, loan.monthlyAmount)
    const balance = loan.monthlyAmount - amountPaid

    if (balance > 0) {
      totalArrears += balance
      unpaidMonths.push({
        month: mKey,
        balance,
        rentAmount: loan.monthlyAmount,
        amountPaid,
        dueDate: override?.dueDate ?? getLoanDueDate(loan, mKey),
      })
    }
  }

  return { priorArrears: totalArrears, priorUnpaidMonths: unpaidMonths }
}

/**
 * Returns enriched loan rows for the given month, ready to render on the dashboard.
 *
 * @param {string} [monthKey] - "YYYY-MM"
 * @returns {Array<Object>}
 */
export function getLoanRowsForMonth(monthKey = getMonthKey()) {
  const loans = getActiveLoans()
  if (loans.length === 0) return []

  const overrides = getData('payments')
  const priorMonths = getPriorTrackedMonths(monthKey)

  return loans
    .filter((loan) => {
      // Don't show loans in months before the loan was created
      const startMonth = loan.startDate ? loan.startDate.slice(0, 7) : ''
      return !startMonth || startMonth <= monthKey
    })
    .map((loan) => {
      const override = readLoanPayment(overrides, loan.id, monthKey)
      const defaultDueDate = getLoanDueDate(loan, monthKey)
      const dueDate = override?.dueDate ?? defaultDueDate
      const paid = override?.paid ?? false
      const paidDate = paid ? override.paidDate : null

      const entries = loanPaymentEntries(override)
      const received = entries.reduce((sum, p) => sum + p.amount, 0)
      const amountPaid = paid ? loan.monthlyAmount : Math.min(received, loan.monthlyAmount)
      const balance = loan.monthlyAmount - amountPaid

      const { priorArrears, priorUnpaidMonths } = getPriorUnpaidForLoan(loan, priorMonths, overrides)

      const enriched = {
        id: loan.id,
        isLoan: true,
        address: loan.borrowerName,
        tenantName: loan.borrowerName,
        phone: loan.phone,
        rentAmount: loan.monthlyAmount,
        principalAmount: loan.principalAmount,
        monthlyAmount: loan.monthlyAmount,
        dueDay: loan.dueDay,
        startDate: loan.startDate,
        capitalDueDate: loan.capitalDueDate,
        note: loan.note,
        dueDate,
        paidCurrentMonth: paid,
        paidDate,
        paymentLog: entries,
        amountPaid,
        balance,
        daysCovered: daysCoveredBy(amountPaid, loan.monthlyAmount),
        priorArrears,
        priorUnpaidMonths,
        totalOwed: balance + priorArrears,
        balanceDueDate: !paid && entries.length > 0 ? (override?.balanceDue ?? null) : null,
      }

      return {
        ...enriched,
        status: getStatusForTenant(enriched),
      }
    })
}

/**
 * Persists a paid/unpaid status for a loan in a given month.
 *
 * @param {string} id - Loan ID
 * @param {boolean} paid
 * @param {string} [monthKey]
 */
export function setLoanPaymentStatus(id, paid, monthKey = getMonthKey()) {
  const overrides = getData('payments')
  if (paid) {
    const loanRows = getLoanRowsForMonth(monthKey)
    const loan = loanRows.find((l) => l.id === id)
    if (loan && loan.priorUnpaidMonths?.length > 0) {
      for (const prior of loan.priorUnpaidMonths) {
        const currentPrior = readLoanPayment(overrides, id, prior.month) ?? {}
        overrides[loanPaymentKey(id, prior.month)] = {
          ...currentPrior,
          paid: true,
          paidDate: toIso(new Date()),
        }
      }
    }
  }
  const current = readLoanPayment(overrides, id, monthKey) ?? {}
  overrides[loanPaymentKey(id, monthKey)] = {
    ...current,
    paid,
    paidDate: paid ? toIso(new Date()) : null,
  }
  setData('payments', overrides)
}

/** Records money received towards a single month's loan payment. */
function recordSingleLoanPayment(overrides, id, amount, monthKey, date, balanceDueDate = '') {
  if (!(amount > 0)) return
  const loans = getLoans()
  const loan = loans.find((l) => l.id === id)
  if (!loan) return

  const monthlyAmount = loan.monthlyAmount
  const stored = readLoanPayment(overrides, id, monthKey) ?? { paid: false, paidDate: null }
  const earlier = loanPaymentEntries(stored).map((p) =>
    p.id === 'legacy' ? { ...p, id: `legacy-${monthKey}` } : p,
  )
  const currentPaid = stored.paid ? monthlyAmount : earlier.reduce((sum, p) => sum + p.amount, 0)
  const newTotal = Math.min(monthlyAmount, currentPaid + amount)
  const actualAdded = newTotal - currentPaid

  if (actualAdded <= 0 && stored.paid) return

  const entry = {
    id: `P${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    amount: actualAdded,
    date,
  }
  const payments = [...earlier, entry]

  if (newTotal >= monthlyAmount) {
    overrides[loanPaymentKey(id, monthKey)] = { ...stored, payments, paid: true, paidDate: date }
  } else {
    const due = balanceDueDate || stored.balanceDue
    overrides[loanPaymentKey(id, monthKey)] = {
      ...stored,
      payments,
      paid: false,
      paidDate: null,
      ...(due ? { balanceDue: due } : {}),
    }
  }
}

/**
 * Records a partial or full payment for a loan, applying to prior unpaid months first.
 *
 * @param {string} id - Loan ID
 * @param {number} amount - COP
 * @param {string} [monthKey]
 * @param {string} [date]
 * @param {string} [balanceDueDate]
 */
export function recordLoanPartialPayment(
  id,
  amount,
  monthKey = getMonthKey(),
  date = toIso(new Date()),
  balanceDueDate = '',
) {
  if (!Number.isFinite(amount) || amount <= 0 || validateDate(date) || (balanceDueDate && validateDate(balanceDueDate))) {
    return null
  }
  const loans = getLoanRowsForMonth(monthKey)
  const loan = loans.find((l) => l.id === id)
  if (!loan) return null

  const overrides = getData('payments')
  let remaining = amount
  const priorMonths = loan.priorUnpaidMonths ?? []

  // 1. Apply to prior unpaid months (oldest first)
  for (const prior of priorMonths) {
    if (remaining <= 0) break
    const toApply = Math.min(remaining, prior.balance)
    recordSingleLoanPayment(overrides, id, toApply, prior.month, date, '')
    remaining -= toApply
  }

  // 2. Apply any remainder to current month
  if (remaining > 0 && (!loan.paidCurrentMonth || loan.balance > 0)) {
    const toApply = Math.min(remaining, loan.balance)
    recordSingleLoanPayment(overrides, id, toApply, monthKey, date, balanceDueDate)
    remaining -= toApply
  }

  setData('payments', overrides)
}

/** Changes the paid date for a loan in a given month. */
export function setLoanPaidDate(id, date, monthKey = getMonthKey()) {
  const overrides = getData('payments')
  const current = readLoanPayment(overrides, id, monthKey)
  if (!current?.paid || validateDate(date)) return
  overrides[loanPaymentKey(id, monthKey)] = { ...current, paidDate: date }
  setData('payments', overrides)
}

/** Changes the due date for a loan in a single month. */
export function setLoanDueDate(id, date, monthKey = getMonthKey()) {
  if (validateDate(date)) return
  const loans = getLoans()
  const loan = loans.find((l) => l.id === id)
  if (!loan) return

  const overrides = getData('payments')
  const current = readLoanPayment(overrides, id, monthKey) ?? { paid: false, paidDate: null }
  const defaultDueDate = getLoanDueDate(loan, monthKey)
  if (date === defaultDueDate) {
    const { dueDate: _old, ...rest } = current
    overrides[loanPaymentKey(id, monthKey)] = rest
  } else {
    overrides[loanPaymentKey(id, monthKey)] = { ...current, dueDate: date }
  }
  setData('payments', overrides)
}

/** Changes the balance due date for a loan. */
export function setLoanBalanceDueDate(id, date, monthKey = getMonthKey()) {
  if (validateDate(date)) return
  const overrides = getData('payments')
  const current = readLoanPayment(overrides, id, monthKey)
  if (!current || current.paid) return
  overrides[loanPaymentKey(id, monthKey)] = { ...current, balanceDue: date }
  setData('payments', overrides)
}
