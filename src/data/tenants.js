import { getData, setData } from './store.js'
import { loadSeedUnits } from './seedUnits.js'
import { getTrackingStart } from './tracking.js'
import { t, formatLocaleDate, capitalize } from './i18n.js'

/** Days a month is assumed to have when turning a partial payment into days covered. */
export const DAYS_PER_MONTH = 30

/** Sort order for the unit grid: overdue, due soon, upcoming, paid, then vacant. */
const STATUS_ORDER = { overdue: 0, 'due-soon': 1, upcoming: 2, paid: 3, vacant: 4 }

const pad = (n) => String(n).padStart(2, '0')

/** Parses an ISO "YYYY-MM-DD" string as a local-time date (avoids UTC off-by-one). */
function parseLocalDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toIso(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Returns the month key ("YYYY-MM") for a date.
 *
 * @param {Date} [date] - defaults to today
 * @returns {string}
 */
export function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

/**
 * Returns the selectable months, newest first: next month (some tenants pay before the due
 * date), the current month, then every earlier month back to when tracking started.
 *
 * @returns {Array<{ value: string, label: string }>}
 */
export function getAvailableMonths() {
  const now = new Date()
  const [startY, startM] = getTrackingStart().split('-').map(Number)
  const monthsSinceStart = Math.max(0, (now.getFullYear() - startY) * 12 + (now.getMonth() + 1 - startM))
  return Array.from({ length: monthsSinceStart + 2 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + 1 - i, 1)
    return {
      value: getMonthKey(d),
      label: capitalize(formatLocaleDate(d, { month: 'long', year: 'numeric' })),
    }
  })
}

/**
 * Reads the stored units: { added: [unit], seeded: boolean }. `edits` and `deleted` are
 * leftovers from when a built-in seed list existed; they are folded in by importSeedUnits.
 */
function readUnitEdits() {
  const raw = getData('units')
  return { edits: raw.edits || {}, deleted: raw.deleted || [], added: raw.added || [], seeded: !!raw.seeded }
}

function writeUnitEdits(data) {
  setData('units', data)
}

/**
 * Returns the stored list of units sorted by address (several tenants can share one
 * address). The list comes only from saved data (this device / Google Drive): no tenant
 * details are built into the app. Units saved before addresses existed fall back to their
 * old unit number.
 *
 * @returns {Array<Object>}
 */
export function getUnits() {
  const { edits, added } = readUnitEdits()
  return added
    .map((u) => ({ ...u, ...(edits[u.id] || {}) }))
    .map((u) => ({ ...u, address: u.address ?? u.unitNumber ?? '', phone: u.phone ?? '' }))
    .sort((a, b) => compareAddress(a, b) || a.tenantName.localeCompare(b.tenantName))
}

/**
 * One-time import of the landlord's starting tenant list into saved data, so it lives only
 * in this device's storage and Google Drive and not in the app's code. The list is read from
 * the git-ignored `private/tenants.json` and only works under `npm run dev`. Any edits,
 * deletions and added units saved before are folded in, then the import never runs again.
 * Where the list is unavailable (published app, other devices) nothing happens.
 *
 * @returns {Promise<boolean>} true when units were imported
 */
export async function importSeedUnits() {
  if (readUnitEdits().seeded) return false
  const seed = await loadSeedUnits()
  if (!seed) return false

  const { edits, deleted, added, seeded } = readUnitEdits()
  if (seeded) return false // another call finished the import while the list was loading

  const known = new Set(added.map((u) => u.id))
  const fromSeed = seed
    .filter((u) => !deleted.includes(u.id) && !known.has(u.id))
    .map((u) => ({ ...u, ...(edits[u.id] || {}) }))
  writeUnitEdits({ added: [...fromSeed, ...added], seeded: true })
  return true
}

/** Orders by address, treating numbers inside it naturally ("Gris 2" before "Gris 10"). */
function compareAddress(a, b) {
  return a.address.localeCompare(b.address, undefined, { numeric: true, sensitivity: 'base' })
}

/** Today as an ISO date string "YYYY-MM-DD". */
export function getTodayIso() {
  return toIso(new Date())
}

/**
 * Tenancy history, stored only for units that have had a move-out:
 * { [unitId]: Array<{ tenantName, rentAmount, dueDay, moveIn, moveOut, ... }> }, oldest first.
 * A tenancy occupies a unit from `moveIn` (null = since forever) up to, but not
 * including, `moveOut` (null = open-ended).
 */
function readTenancies() {
  return getData('tenancies')
}

function writeTenancies(data) {
  setData('tenancies', data)
}

/** The implicit first tenancy of a unit, built from its own (possibly edited) fields. */
function baseTenancy(unit) {
  return {
    tenantName: unit.tenantName,
    phone: unit.phone,
    tenantNote: unit.tenantNote ?? '',
    rentAmount: unit.rentAmount,
    dueDay: unit.dueDay,
    paidCurrentMonth: unit.paidCurrentMonth,
    moveIn: null,
    moveOut: null,
  }
}

function tenanciesFor(unit, stored) {
  return stored[unit.id] ?? [baseTenancy(unit)]
}

function occupiesOn(tenancy, iso) {
  return (!tenancy.moveIn || tenancy.moveIn <= iso) && (!tenancy.moveOut || iso < tenancy.moveOut)
}

/**
 * Finds who owes rent in a month: the tenancy that occupies the unit on its own
 * due date. If several qualify the latest wins; if none, the unit is vacant.
 */
function findOccupant(unit, tenancies, monthKey) {
  let found = null
  for (const tenancy of tenancies) {
    const tenant = { ...unit, ...tenancy }
    const dueDate = getDueDate(tenant, monthKey)
    if (occupiesOn(tenancy, dueDate)) found = { tenant, dueDate }
  }
  return found
}

/** Row for a unit nobody occupies on the due date. `rentAmount` is the vacancy loss. */
function buildVacantRow(unit, tenancies, monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const monthStart = `${monthKey}-01`
  const monthEnd = toIso(new Date(y, m, 0))

  const prev = tenancies.filter((t) => t.moveOut && t.moveOut <= monthEnd).pop()
  const next = tenancies.find((t) => t.moveIn && t.moveIn > (prev?.moveOut ?? monthStart))
  const ref = prev ?? next ?? tenancies[0]

  return {
    id: unit.id,
    address: unit.address,
    tenantName: null,
    phone: '',
    unitNote: unit.unitNote ?? '',
    serviceWater: unit.serviceWater ?? '',
    serviceGas: unit.serviceGas ?? '',
    serviceElectricity: unit.serviceElectricity ?? '',
    rentAmount: ref.rentAmount,
    status: 'vacant',
    vacantSince: prev?.moveOut ?? null,
    moveInDate: next?.moveIn ?? null,
    targetMoveIn: unit.targetMoveIn ?? null,
    dueDate: null,
    paidDate: null,
    paidCurrentMonth: false,
  }
}

/**
 * Returns units for the management table. Tenant fields reflect who lives there
 * today (or the most recent tenant when vacant), with a concrete `dueDay` and
 * move-in / move-out state flags.
 *
 * @returns {Array<Object>}
 */
export function getEditableUnits() {
  const stored = readTenancies()
  const today = getTodayIso()

  return getUnits().map((unit) => {
    const list = tenanciesFor(unit, stored)
    const last = list[list.length - 1]
    const current = list.find((t) => occupiesOn(t, today))
    const next = list.find((t) => t.moveIn && t.moveIn > today)
    const ended = list.filter((t) => t.moveOut && t.moveOut <= today)
    const shown = { ...unit, ...(current ?? ended[ended.length - 1] ?? last) }

    return {
      ...shown,
      vacant: !current,
      vacantSince: current ? null : (ended[ended.length - 1]?.moveOut ?? null),
      moveOutDate: current?.moveOut ?? null,
      nextMoveIn: next?.moveIn ?? null,
      nextTenantName: next?.tenantName ?? null,
      canMoveOut: !!current && !current.moveOut,
      canMoveIn: last.moveOut != null && !next,
      canUndoMoveOut: last.moveOut != null && !next,
      canCancelMoveIn: !!next,
    }
  })
}

function validateTenantFields(fields) {
  const rent = Number(fields.rentAmount)
  const day = Number(fields.dueDay)
  if (!String(fields.tenantName ?? '').trim()) return t('Tenant name is required.')
  if (!Number.isFinite(rent) || rent <= 0) return t('Rent must be greater than 0.')
  if (!Number.isInteger(day) || day < 1 || day > 31) return t('Due day must be between 1 and 31.')
  return null
}

/**
 * Validates editable unit fields. Addresses may repeat: several tenants can live at one address.
 *
 * @param {{ address: string, tenantName: string, phone?: string, rentAmount: number|string, dueDay: number|string, tenantNote?: string, unitNote?: string, serviceWater?: string, serviceGas?: string, serviceElectricity?: string }} fields
 * @returns {string | null} error message, or null when valid
 */
export function validateUnit(fields) {
  if (!String(fields.address ?? '').trim()) return t('Address is required.')
  return validateTenantFields(fields)
}

function cleanFields(fields) {
  return {
    address: String(fields.address).trim(),
    tenantName: String(fields.tenantName).trim(),
    phone: String(fields.phone ?? '').trim(),
    rentAmount: Number(fields.rentAmount),
    dueDay: Number(fields.dueDay),
    tenantNote: String(fields.tenantNote ?? '').trim(),
    unitNote: String(fields.unitNote ?? '').trim(),
    serviceWater: String(fields.serviceWater ?? '').trim(),
    serviceGas: String(fields.serviceGas ?? '').trim(),
    serviceElectricity: String(fields.serviceElectricity ?? '').trim(),
  }
}

/** Applies a partial update to a unit's own record. */
function patchUnit(id, patch) {
  const data = readUnitEdits()
  const idx = data.added.findIndex((u) => u.id === id)
  if (idx >= 0) data.added[idx] = { ...data.added[idx], ...patch }
  writeUnitEdits(data)
}

/**
 * Updates a unit's address, unit note and paid-service notes (water, gas, electricity) and its current
 * tenant's name, phone, rent, due day of month and tenant note. Once a unit has
 * tenancy history the tenant fields change on the current tenancy (and are ignored while vacant); the
 * address, unit note and services always stay with the unit.
 *
 * @param {string} id
 * @param {{ address: string, tenantName: string, phone?: string, rentAmount: number|string, dueDay: number|string, tenantNote?: string, unitNote?: string, serviceWater?: string, serviceGas?: string, serviceElectricity?: string }} fields
 */
export function updateUnit(id, fields) {
  const clean = cleanFields(fields)
  const stored = readTenancies()
  const list = stored[id]
  const idx = list ? list.findIndex((t) => occupiesOn(t, getTodayIso())) : -1

  if (list) {
    // Tenant fields belong to the tenancy; a vacant unit only has its address to change
    const { address, unitNote, serviceWater, serviceGas, serviceElectricity, ...tenantFields } = clean
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...tenantFields }
      writeTenancies(stored)
    }
    patchUnit(id, { address, unitNote, serviceWater, serviceGas, serviceElectricity })
  } else {
    patchUnit(id, clean)
  }
}

/**
 * Adds a new unit (unpaid) and returns its generated id.
 *
 * @param {{ address: string, tenantName: string, phone?: string, rentAmount: number|string, dueDay: number|string, tenantNote?: string, unitNote?: string }} fields
 * @returns {string}
 */
export function addUnit(fields) {
  const data = readUnitEdits()
  const id = `N${Date.now()}`
  data.added.push({ id, ...cleanFields(fields), paidCurrentMonth: false })
  writeUnitEdits({ added: data.added, seeded: data.seeded })
  return id
}

/**
 * Deletes a unit and its tenancy history.
 *
 * @param {string} id
 */
export function deleteUnit(id) {
  const data = readUnitEdits()
  writeUnitEdits({ added: data.added.filter((u) => u.id !== id), seeded: data.seeded })

  const stored = readTenancies()
  delete stored[id]
  writeTenancies(stored)
}

/** Loads a unit's tenancy list (copy) and its latest entry. */
function loadTenancies(id) {
  const unit = getUnits().find((u) => u.id === id)
  const list = [...tenanciesFor(unit, readTenancies())]
  return { list, last: list[list.length - 1] }
}

function saveTenancies(id, list) {
  const stored = readTenancies()
  stored[id] = list
  writeTenancies(stored)
}

/**
 * Validates a move-out date for a unit's current tenant.
 *
 * @param {string} id
 * @param {string} date - ISO date
 * @returns {string | null}
 */
export function validateMoveOut(id, date) {
  if (!date) return t('Move-out date is required.')
  const { last } = loadTenancies(id)
  if (last.moveIn && date <= last.moveIn) {
    return t('Move-out must be after the move-in date ({date}).', { date: formatDueDate(last.moveIn) })
  }
  return null
}

/**
 * Ends the current tenancy: the unit is vacant from `date` until someone moves in.
 *
 * @param {string} id
 * @param {string} date - ISO date
 */
export function moveOutUnit(id, date) {
  const { list, last } = loadTenancies(id)
  list[list.length - 1] = { ...last, moveOut: date }
  saveTenancies(id, list)
}

/**
 * Validates a new tenant move-in.
 *
 * @param {string} id
 * @param {{ tenantName: string, phone?: string, rentAmount: number|string, dueDay: number|string, date: string, tenantNote?: string }} fields
 * @returns {string | null}
 */
export function validateMoveIn(id, fields) {
  const err = validateTenantFields(fields)
  if (err) return err
  if (!fields.date) return t('Move-in date is required.')
  const { last } = loadTenancies(id)
  if (last.moveOut && fields.date < last.moveOut) {
    return t("Move-in can't be before the previous move-out ({date}).", { date: formatDueDate(last.moveOut) })
  }
  return null
}

/**
 * Starts a new tenancy (unpaid) on `fields.date`, which may be in the future. The unit's
 * target move-in date, if any, is cleared because it has been met.
 *
 * @param {string} id
 * @param {{ tenantName: string, phone?: string, rentAmount: number|string, dueDay: number|string, date: string, tenantNote?: string }} fields
 */
export function moveInUnit(id, fields) {
  const { list } = loadTenancies(id)
  list.push({
    tenantName: String(fields.tenantName).trim(),
    phone: String(fields.phone ?? '').trim(),
    tenantNote: String(fields.tenantNote ?? '').trim(),
    rentAmount: Number(fields.rentAmount),
    dueDay: Number(fields.dueDay),
    paidCurrentMonth: false,
    moveIn: fields.date,
    moveOut: null,
    payKey: `${id}@${fields.date}`,
  })
  saveTenancies(id, list)
  patchUnit(id, { targetMoveIn: null })
}

/**
 * Sets the date the landlord aims to have a vacant unit let again. It is shown on the vacant tile
 * (when no move-in is scheduled) and cleared automatically by moveInUnit.
 *
 * @param {string} id - unit id
 * @param {string} date - ISO date "YYYY-MM-DD"
 */
export function setTargetMoveIn(id, date) {
  if (validateDate(date)) return
  patchUnit(id, { targetMoveIn: date })
}

/** Reopens the latest tenancy (undoes its move-out). */
export function undoMoveOut(id) {
  const { list, last } = loadTenancies(id)
  list[list.length - 1] = { ...last, moveOut: null }
  saveTenancies(id, list)
}

/** Removes a scheduled (future) tenancy. */
export function cancelMoveIn(id) {
  const { list, last } = loadTenancies(id)
  if (list.length > 1 && last.moveIn > getTodayIso()) {
    list.pop()
    saveTenancies(id, list)
  }
}

/**
 * Returns how many days ahead a payment counts as "due soon": 3 days on a
 * weekday, 4 days on a weekend (Saturday/Sunday).
 *
 * @param {Date} [date] - defaults to today
 * @returns {number}
 */
export function getDueSoonWindowDays(date = new Date()) {
  const day = date.getDay()
  return day === 0 || day === 6 ? 4 : 3
}

/**
 * Returns the payment status for a single tenant based on today's date.
 * Status is computed at runtime — never stored in JSON.
 *
 * @param {{ paidCurrentMonth: boolean, dueDate: string }} tenant
 * @returns {'paid' | 'due-soon' | 'upcoming' | 'overdue'}
 */
export function getStatusForTenant(tenant) {
  if (tenant.paidCurrentMonth) return 'paid'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const due = parseLocalDate(tenant.dueDate)
  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'overdue'
  return diffDays <= getDueSoonWindowDays() ? 'due-soon' : 'upcoming'
}

/** Builds the due date for a tenant in the given month: `dueDay` of that month, clamped to its length. */
function getDueDate(unit, monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return toIso(new Date(y, m - 1, Math.min(unit.dueDay, lastDay)))
}

/**
 * Days of the month a payment covers, assuming a DAYS_PER_MONTH-day month (rounded down, so a tenant is
 * never credited with more than they paid): 250,000 of a 500,000 rent covers 15 days.
 *
 * @param {number} amountPaid
 * @param {number} rentAmount
 * @returns {number}
 */
export function daysCoveredBy(amountPaid, rentAmount) {
  if (!rentAmount || !(amountPaid > 0)) return 0
  return Math.min(DAYS_PER_MONTH, Math.floor((amountPaid * DAYS_PER_MONTH) / rentAmount))
}

/**
 * Previews a part payment before it is saved.
 *
 * @param {number} rentAmount - the month's rent
 * @param {number} alreadyPaid - amount already received for the month
 * @param {number} amount - the new payment (whole pesos)
 * @returns {{ totalPaid: number, balance: number, days: number, complete: boolean } | null} null when `amount` isn't a positive number
 */
export function describePayment(rentAmount, alreadyPaid, amount) {
  if (!(amount > 0)) return null
  const totalPaid = Math.min(rentAmount, (alreadyPaid ?? 0) + amount)
  return {
    totalPaid,
    balance: rentAmount - totalPaid,
    days: daysCoveredBy(totalPaid, rentAmount),
    complete: totalPaid >= rentAmount,
  }
}

/**
 * Part payments of an override as a dated list, oldest first. Older records only stored a running
 * total (`amountPaid`); that total is shown as one entry with no date.
 *
 * @param {{ payments?: Array<{ id: string, amount: number, date: string }>, amountPaid?: number } | null} override
 * @returns {Array<{ id: string, amount: number, date: string | null }>}
 */
function paymentEntries(override) {
  if (override?.payments?.length) return [...override.payments].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  return override?.amountPaid > 0 ? [{ id: 'legacy', amount: override.amountPaid, date: null }] : []
}

/** Reads a stored override { paid, paidDate, dueDate?, payments?, amountPaid? }: legacy boolean values have no paid date. */
function normalizeOverride(value) {
  if (value === undefined) return null
  if (typeof value === 'boolean') {
    return { paid: value, paidDate: value ? toIso(new Date()) : null }
  }
  return value
}

/**
 * Sort comparator: overdue, due soon, upcoming, paid, then vacant (by address). Overdue and due soon run
 * by due date, oldest/soonest first (upcoming too); paid runs by most recent payment date first.
 */
function compareTenants(a, b) {
  const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  if (byStatus) return byStatus
  if (a.status === 'vacant') return compareAddress(a, b)
  if (a.status === 'paid') {
    return (b.paidDate || '').localeCompare(a.paidDate || '') || a.dueDate.localeCompare(b.dueDate)
  }
  return a.dueDate.localeCompare(b.dueDate)
}

/**
 * Returns unit ids in the current order, with `id` moved to the front of its own status group
 * (e.g. a unit just marked paid becomes the first entry of the paid section).
 *
 * @param {Array<Object>} tenants - rows from getAllTenants()
 * @param {string} id - unit id to move
 * @returns {string[]}
 */
export function idsWithFirstInStatus(tenants, id) {
  const unit = tenants.find((t) => t.id === id)
  if (!unit) return tenants.map((t) => t.id)
  const rest = tenants.filter((t) => t.id !== id)
  const at = rest.findIndex((t) => t.status === unit.status)
  rest.splice(at === -1 ? rest.length : at, 0, unit)
  return rest.map((t) => t.id)
}

/**
 * Reorders tenant rows to follow a previously captured list of unit ids, so a tile stays where it
 * was after an edit that would otherwise re-sort it. Ids missing from `order` (new units) go last.
 *
 * @param {Array<Object>} tenants - rows from getAllTenants()
 * @param {string[]} order - unit ids in the order to keep
 * @returns {Array<Object>}
 */
export function sortByOrder(tenants, order) {
  const rank = new Map(order.map((id, index) => [id, index]))
  return [...tenants].sort((a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length))
}

/**
 * Reads the stored payment records and merges them into the JSON seed data for a month.
 * A month is unpaid until marked paid: no payment history is assumed.
 * One row per unit: the tenant living there on the due date (with computed `status`
 * and `dueDate`), or a `vacant` row. Sorted by `compareTenants`.
 *
 * @param {string} [monthKey] - "YYYY-MM", defaults to the current month
 * @returns {Array<Object>}
 */
export function getAllTenants(monthKey = getMonthKey()) {
  const overrides = getData('payments')
  const stored = readTenancies()

  return getUnits()
    .map((unit) => {
      const tenancies = tenanciesFor(unit, stored)
      const occupant = findOccupant(unit, tenancies, monthKey)
      if (!occupant) return buildVacantRow(unit, tenancies, monthKey)

      const { tenant } = occupant
      const override = normalizeOverride(overrides[`${monthKey}:${tenant.payKey ?? unit.id}`])
      // A due date changed for this month only wins over the tenant's usual due day
      const dueDate = override?.dueDate ?? occupant.dueDate

      const paid = override?.paid ?? false
      const paidDate = paid ? override.paidDate : null
      // Part payments keep the unit unpaid (status follows the due date) but count toward collected
      const entries = paymentEntries(override)
      const received = entries.reduce((sum, p) => sum + p.amount, 0)
      const amountPaid = paid ? tenant.rentAmount : Math.min(received, tenant.rentAmount)

      const enriched = {
        ...tenant,
        dueDate,
        // Date the rest of a part payment is promised; information only, status still follows the due date
        balanceDueDate: !paid && entries.length > 0 ? (override?.balanceDue ?? null) : null,
        paidCurrentMonth: paid,
        paidDate,
        paymentLog: entries,
        amountPaid,
        balance: tenant.rentAmount - amountPaid,
        daysCovered: daysCoveredBy(amountPaid, tenant.rentAmount),
      }
      return { ...enriched, status: getStatusForTenant(enriched) }
    })
    .sort(compareTenants)
}

/**
 * Returns tenants filtered by status, or all tenants when status is 'all'.
 *
 * @param {'all' | 'paid' | 'due-soon' | 'upcoming' | 'overdue' | 'vacant'} status
 * @param {string} [monthKey]
 * @returns {Array<Object>}
 */
export function getTenantsByStatus(status, monthKey) {
  const all = getAllTenants(monthKey)
  if (status === 'all') return all
  return all.filter((t) => t.status === status)
}

/**
 * Returns aggregate counts and totals for a month.
 *
 * @param {string} [monthKey]
 * Vacant units count toward `total` but not `totalExpected`; their rent is `vacancyLoss`.
 *
 * Partial payments count as collected; the unpaid balance stays in the unit's status bucket.
 *
 * @returns {{ total: number, vacant: number, vacancyLoss: number, paid: number, dueSoon: number, upcoming: number, overdue: number,
 *             totalExpected: number, totalCollected: number,
 *             totalDueSoon: number, totalUpcoming: number, totalOverdue: number }}
 */
export function getSummaryStats(monthKey) {
  const tenants = getAllTenants(monthKey)

  return tenants.reduce(
    (acc, t) => {
      acc.total += 1
      if (t.status === 'vacant') {
        acc.vacant += 1
        acc.vacancyLoss += t.rentAmount
        return acc
      }
      acc.totalExpected += t.rentAmount
      // Part payments count as collected; only the unpaid balance stays in the status bucket
      acc.totalCollected += t.amountPaid
      if (t.status === 'paid') {
        acc.paid += 1
      } else if (t.status === 'due-soon') {
        acc.dueSoon += 1
        acc.totalDueSoon += t.balance
      } else if (t.status === 'upcoming') {
        acc.upcoming += 1
        acc.totalUpcoming += t.balance
      } else if (t.status === 'overdue') {
        acc.overdue += 1
        acc.totalOverdue += t.balance
      }
      return acc
    },
    {
      total: 0,
      vacant: 0,
      vacancyLoss: 0,
      paid: 0,
      dueSoon: 0,
      upcoming: 0,
      overdue: 0,
      totalExpected: 0,
      totalCollected: 0,
      totalDueSoon: 0,
      totalUpcoming: 0,
      totalOverdue: 0,
    },
  )
}

/** Key under which a unit's payment for a month is stored (replacement tenants have their own `payKey`). */
function paymentKey(id, monthKey) {
  const unit = getUnits().find((u) => u.id === id)
  const occupant = unit && findOccupant(unit, tenanciesFor(unit, readTenancies()), monthKey)
  return `${monthKey}:${occupant?.tenant.payKey ?? id}`
}

/** Reads the stored payment record for a unit and month, or null. */
function readPayment(overrides, id, monthKey) {
  return normalizeOverride(overrides[paymentKey(id, monthKey)])
}

/**
 * Persists a paid/unpaid override for a tenant in a given month.
 * Marking paid records today's date as the date paid (editable with setPaidDate) and settles the
 * month in full; the part payments stay in the record as history. Marking unpaid clears the date and
 * all part payments. A due date changed for the month is kept.
 *
 * @param {string} id - Tenant ID (e.g. "T01")
 * @param {boolean} paid
 * @param {string} [monthKey] - defaults to the current month
 */
export function setPaymentStatus(id, paid, monthKey = getMonthKey()) {
  const overrides = getData('payments')
  const { amountPaid: _total, balanceDue: _due, payments: history, ...current } = readPayment(overrides, id, monthKey) ?? {}
  if (paid && history?.length) current.payments = history
  overrides[paymentKey(id, monthKey)] = { ...current, paid, paidDate: paid ? toIso(new Date()) : null }
  setData('payments', overrides)
}

/**
 * Validates a part payment typed by the user.
 *
 * @param {number} amount - whole pesos (NaN when empty)
 * @returns {string | null} error message, or null when valid
 */
export function validatePartPayment(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return t('Enter the amount received.')
  return null
}

/**
 * Records money received towards a month's rent without necessarily paying it in full. Each payment is
 * saved as its own dated entry (`paymentLog` on the unit's row) and amounts add up. The amount that would
 * go over the rent is not recorded. When the total reaches the rent the month is marked paid (today's
 * date); otherwise the unit stays unpaid with `amountPaid` / `balance` / `daysCovered` filled in.
 *
 * @param {string} id - Tenant ID (e.g. "T01")
 * @param {number} amount - whole pesos received now
 * @param {string} [monthKey] - defaults to the current month
 * @param {string} [date] - ISO date received, defaults to today
 * @param {string} [balanceDueDate] - ISO date the remaining balance is expected; empty keeps any earlier one.
 *   Dropped once the month is paid in full.
 * @returns {{ totalPaid: number, balance: number, days: number, complete: boolean } | null} the result, or null when nothing was recorded
 */
export function recordPartialPayment(id, amount, monthKey = getMonthKey(), date = toIso(new Date()), balanceDueDate = '') {
  if (validatePartPayment(amount) || validateDate(date) || (balanceDueDate && validateDate(balanceDueDate))) return null
  const tenant = getAllTenants(monthKey).find((t) => t.id === id)
  if (!tenant || tenant.status === 'vacant') return null

  const result = describePayment(tenant.rentAmount, tenant.amountPaid, amount)
  const overrides = getData('payments')
  const stored = readPayment(overrides, id, monthKey) ?? { paid: false, paidDate: null }
  const { amountPaid: _total, balanceDue: keptDue, ...current } = stored
  // Keep older total-only records in the list (undated, shown as "Earlier") so they aren't lost
  const earlier = paymentEntries(stored).map((p) => (p.id === 'legacy' ? { ...p, id: `legacy-${monthKey}` } : p))
  const entry = {
    id: `P${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    amount: result.totalPaid - tenant.amountPaid,
    date,
  }
  const payments = [...earlier, entry]

  if (result.complete) {
    overrides[paymentKey(id, monthKey)] = { ...current, payments, paid: true, paidDate: date }
  } else {
    const due = balanceDueDate || keptDue
    overrides[paymentKey(id, monthKey)] = { ...current, payments, paid: false, paidDate: null, ...(due ? { balanceDue: due } : {}) }
  }
  setData('payments', overrides)
  return result
}

/**
 * Sets (or changes) the date the balance of a part-paid month is expected. Does nothing unless the month
 * has a part payment and is still unpaid. It never changes the unit's status or due date.
 *
 * @param {string} id - Tenant ID (e.g. "T01")
 * @param {string} date - ISO date "YYYY-MM-DD"
 * @param {string} [monthKey] - defaults to the current month
 */
export function setBalanceDueDate(id, date, monthKey = getMonthKey()) {
  if (validateDate(date)) return
  const overrides = getData('payments')
  const current = readPayment(overrides, id, monthKey)
  if (!current || current.paid || paymentEntries(current).length === 0) return
  overrides[paymentKey(id, monthKey)] = { ...current, balanceDue: date }
  setData('payments', overrides)
}

/**
 * Validates a calendar date typed or picked by the user.
 *
 * @param {string} date - ISO date "YYYY-MM-DD"
 * @returns {string | null} error message, or null when valid
 */
export function validateDate(date) {
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') && date >= '2000-01-01' && toIso(parseLocalDate(date)) === date
  return valid ? null : t('Enter a valid date.')
}

/**
 * Changes the date a tenant paid in a given month (before the due date = early, after = late).
 * The month must already be marked paid.
 *
 * @param {string} id - Tenant ID (e.g. "T01")
 * @param {string} date - ISO date "YYYY-MM-DD"
 * @param {string} [monthKey] - defaults to the current month
 */
export function setPaidDate(id, date, monthKey = getMonthKey()) {
  const overrides = getData('payments')
  const current = readPayment(overrides, id, monthKey)
  if (!current?.paid || validateDate(date)) return
  overrides[paymentKey(id, monthKey)] = { ...current, paidDate: date }
  setData('payments', overrides)
}

/**
 * Changes the due date for one month only (the tenant's due day in Manage Units is not
 * touched). Setting it back to the usual date removes the change.
 *
 * @param {string} id - Tenant ID (e.g. "T01")
 * @param {string} date - ISO date "YYYY-MM-DD"
 * @param {string} [monthKey] - defaults to the current month
 */
export function setDueDate(id, date, monthKey = getMonthKey()) {
  if (validateDate(date)) return
  const unit = getUnits().find((u) => u.id === id)
  const occupant = unit && findOccupant(unit, tenanciesFor(unit, readTenancies()), monthKey)
  if (!occupant) return

  const overrides = getData('payments')
  const { dueDate: _old, ...rest } = readPayment(overrides, id, monthKey) ?? { paid: false, paidDate: null }
  overrides[paymentKey(id, monthKey)] = date === occupant.dueDate ? rest : { ...rest, dueDate: date }
  setData('payments', overrides)
}

/**
 * Returns the number of days until (positive) or since (negative) a due date.
 * Zero means due today.
 *
 * @param {string} dueDate - ISO date string "YYYY-MM-DD"
 * @returns {number}
 */
export function getDaysRelative(dueDate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((parseLocalDate(dueDate) - today) / (1000 * 60 * 60 * 24))
}

/**
 * Formats an ISO due date for display, e.g. "Oct 27, 2026".
 *
 * @param {string} dueDate - ISO date string "YYYY-MM-DD"
 * @returns {string}
 */
export function formatDueDate(dueDate) {
  return formatLocaleDate(parseLocalDate(dueDate), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
