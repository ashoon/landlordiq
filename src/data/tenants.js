import { getData, setData } from './store.js'
import { loadSeedUnits } from './seedUnits.js'
import { getTrackingStart } from './tracking.js'

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
      label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
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
    rentAmount: ref.rentAmount,
    status: 'vacant',
    vacantSince: prev?.moveOut ?? null,
    moveInDate: next?.moveIn ?? null,
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
  if (!String(fields.tenantName ?? '').trim()) return 'Tenant name is required.'
  if (!Number.isFinite(rent) || rent <= 0) return 'Rent must be greater than 0.'
  if (!Number.isInteger(day) || day < 1 || day > 31) return 'Due day must be between 1 and 31.'
  return null
}

/**
 * Validates editable unit fields. Addresses may repeat: several tenants can live at one address.
 *
 * @param {{ address: string, tenantName: string, phone?: string, rentAmount: number|string, dueDay: number|string }} fields
 * @returns {string | null} error message, or null when valid
 */
export function validateUnit(fields) {
  if (!String(fields.address ?? '').trim()) return 'Address is required.'
  return validateTenantFields(fields)
}

function cleanFields(fields) {
  return {
    address: String(fields.address).trim(),
    tenantName: String(fields.tenantName).trim(),
    phone: String(fields.phone ?? '').trim(),
    rentAmount: Number(fields.rentAmount),
    dueDay: Number(fields.dueDay),
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
 * Updates a unit's address and its current tenant's name, phone, rent and due day of month.
 * Once a unit has tenancy history the tenant fields change on the current tenancy
 * (and are ignored while vacant).
 *
 * @param {string} id
 * @param {{ address: string, tenantName: string, phone?: string, rentAmount: number|string, dueDay: number|string }} fields
 */
export function updateUnit(id, fields) {
  const clean = cleanFields(fields)
  const stored = readTenancies()
  const list = stored[id]
  const idx = list ? list.findIndex((t) => occupiesOn(t, getTodayIso())) : -1

  if (list) {
    // Tenant fields belong to the tenancy; a vacant unit only has its address to change
    const { address, ...tenantFields } = clean
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...tenantFields }
      writeTenancies(stored)
    }
    patchUnit(id, { address })
  } else {
    patchUnit(id, clean)
  }
}

/**
 * Adds a new unit (unpaid) and returns its generated id.
 *
 * @param {{ address: string, tenantName: string, phone?: string, rentAmount: number|string, dueDay: number|string }} fields
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
  if (!date) return 'Move-out date is required.'
  const { last } = loadTenancies(id)
  if (last.moveIn && date <= last.moveIn) {
    return `Move-out must be after the move-in date (${formatDueDate(last.moveIn)}).`
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
 * @param {{ tenantName: string, phone?: string, rentAmount: number|string, dueDay: number|string, date: string }} fields
 * @returns {string | null}
 */
export function validateMoveIn(id, fields) {
  const err = validateTenantFields(fields)
  if (err) return err
  if (!fields.date) return 'Move-in date is required.'
  const { last } = loadTenancies(id)
  if (last.moveOut && fields.date < last.moveOut) {
    return `Move-in can't be before the previous move-out (${formatDueDate(last.moveOut)}).`
  }
  return null
}

/**
 * Starts a new tenancy (unpaid) on `fields.date`, which may be in the future.
 *
 * @param {string} id
 * @param {{ tenantName: string, phone?: string, rentAmount: number|string, dueDay: number|string, date: string }} fields
 */
export function moveInUnit(id, fields) {
  const { list } = loadTenancies(id)
  list.push({
    tenantName: String(fields.tenantName).trim(),
    phone: String(fields.phone ?? '').trim(),
    rentAmount: Number(fields.rentAmount),
    dueDay: Number(fields.dueDay),
    paidCurrentMonth: false,
    moveIn: fields.date,
    moveOut: null,
    payKey: `${id}@${fields.date}`,
  })
  saveTenancies(id, list)
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

/** Reads a stored override { paid, paidDate, dueDate? }: legacy boolean values have no paid date. */
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

      const enriched = { ...tenant, dueDate, paidCurrentMonth: paid, paidDate }
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
      if (t.status === 'paid') {
        acc.paid += 1
        acc.totalCollected += t.rentAmount
      } else if (t.status === 'due-soon') {
        acc.dueSoon += 1
        acc.totalDueSoon += t.rentAmount
      } else if (t.status === 'upcoming') {
        acc.upcoming += 1
        acc.totalUpcoming += t.rentAmount
      } else if (t.status === 'overdue') {
        acc.overdue += 1
        acc.totalOverdue += t.rentAmount
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
 * Marking paid records today's date as the date paid (editable with setPaidDate);
 * marking unpaid clears it. A due date changed for the month is kept.
 *
 * @param {string} id - Tenant ID (e.g. "T01")
 * @param {boolean} paid
 * @param {string} [monthKey] - defaults to the current month
 */
export function setPaymentStatus(id, paid, monthKey = getMonthKey()) {
  const overrides = getData('payments')
  const current = readPayment(overrides, id, monthKey)
  overrides[paymentKey(id, monthKey)] = { ...current, paid, paidDate: paid ? toIso(new Date()) : null }
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
  return valid ? null : 'Enter a valid date.'
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
  return parseLocalDate(dueDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
