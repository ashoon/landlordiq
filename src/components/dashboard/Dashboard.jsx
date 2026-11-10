import { useState, useMemo } from 'react'
import {
  getAllTenants,
  compareTenants,
  setPaymentStatus,
  recordPartialPayment,
  setPaidDate,
  setDueDate,
  setBalanceDueDate,
  setTargetMoveIn,
  sortByOrder,
  idsWithFirstInStatus,
} from '../../data/tenants.js'
import {
  getLoanRowsForMonth,
  setLoanPaymentStatus,
  recordLoanPartialPayment,
  setLoanPaidDate,
  setLoanDueDate,
  setLoanBalanceDueDate,
} from '../../data/loans.js'
import { t } from '../../data/i18n.js'
import { getTenantInsightMap } from '../../data/insights.js'
import FilterBar from './FilterBar.jsx'
import UnitCard from './UnitCard.jsx'
import ManageUnits from './ManageUnits.jsx'
import ManageLoans from './ManageLoans.jsx'

/**
 * Dashboard — orchestrates the filter state, search, unit card grid, and unit management section.
 *
 * @param {{ month: string, onStatsChange: () => void, onSelectMonth?: (month: string) => void }} props
 */
export default function Dashboard({ month, onStatsChange, onSelectMonth }) {
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  // refreshKey forces re-read from tenants.js (which reads the store) after a toggle
  const [refreshKey, setRefreshKey] = useState(0)
  // Tile order kept after a date edit so the tile doesn't jump to a new status position.
  // Also set when a unit is marked paid, to put it first in the paid section.
  // Cleared (back to the normal sort) when the filter, search or month changes, a unit is marked unpaid, or units are edited.
  const [pinned, setPinned] = useState(null) // { month, ids } | null

  // A pinned order belongs to one month; drop it when the month changes
  if (pinned && pinned.month !== month) setPinned(null)

  // Payment-behaviour flags per tenant (for the Watch tag); re-read after any change, never affects status or order
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const insightMap = useMemo(() => getTenantInsightMap(month), [month, refreshKey])

  // Re-reads the store on every render cycle that needs it
  const freshTenants = getAllTenants(month)
  const freshLoans = getLoanRowsForMonth(month)
  const freshAll = [...freshTenants, ...freshLoans].sort(compareTenants)
  const allItems = pinned && pinned.month === month ? sortByOrder(freshAll, pinned.ids) : freshAll

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return allItems.filter((t) => {
      const matchesStatus = filterStatus === 'all' || t.status === filterStatus
      const matchesSearch =
        q === '' ||
        t.address.toLowerCase().includes(q) ||
        (t.tenantName ?? '').toLowerCase().includes(q) ||
        (t.phone ?? '').includes(q)
      return matchesStatus && matchesSearch
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, searchQuery, refreshKey, month, pinned])

  function handleDataChange() {
    setPinned(null)
    setRefreshKey((k) => k + 1)
    onStatsChange?.()
  }

  function handleTogglePaid(id, paid) {
    const isLoan = allItems.find((i) => i.id === id)?.isLoan
    if (isLoan) {
      setLoanPaymentStatus(id, paid, month)
    } else {
      setPaymentStatus(id, paid, month)
    }
    // Marked paid: the tile goes to the first spot of the paid section. Marked unpaid: normal sort.
    if (paid) {
      const freshT = getAllTenants(month)
      const freshL = getLoanRowsForMonth(month)
      const fresh = [...freshT, ...freshL].sort(compareTenants)
      const current = pinned ? sortByOrder(fresh, pinned.ids) : fresh
      setPinned({ month, ids: idsWithFirstInStatus(current, id) })
    } else {
      setPinned(null)
    }
    setRefreshKey((k) => k + 1)
    onStatsChange?.()
  }

  function handleRecordPayment(id, amount, balanceDueDate) {
    const isLoan = allItems.find((i) => i.id === id)?.isLoan
    let result
    if (isLoan) {
      result = recordLoanPartialPayment(id, amount, month, undefined, balanceDueDate)
    } else {
      result = recordPartialPayment(id, amount, month, undefined, balanceDueDate)
    }
    // A full payment behaves like Mark as Paid (first in the paid section); a part payment keeps the tile in place
    if (result?.complete) {
      const freshT = getAllTenants(month)
      const freshL = getLoanRowsForMonth(month)
      const fresh = [...freshT, ...freshL].sort(compareTenants)
      const current = pinned ? sortByOrder(fresh, pinned.ids) : fresh
      setPinned({ month, ids: idsWithFirstInStatus(current, id) })
    } else {
      pinCurrentOrder()
    }
    setRefreshKey((k) => k + 1)
    onStatsChange?.()
  }

  // Keeps the order shown now (set once, so several edits in a row don't reshuffle either)
  function pinCurrentOrder() {
    setPinned((p) => (p && p.month === month ? p : { month, ids: allItems.map((t) => t.id) }))
  }

  function handlePaidDateChange(id, date) {
    pinCurrentOrder()
    const isLoan = allItems.find((i) => i.id === id)?.isLoan
    if (isLoan) {
      setLoanPaidDate(id, date, month)
    } else {
      setPaidDate(id, date, month)
    }
    setRefreshKey((k) => k + 1)
    onStatsChange?.()
  }

  function handleDueDateChange(id, date) {
    pinCurrentOrder()
    const isLoan = allItems.find((i) => i.id === id)?.isLoan
    if (isLoan) {
      setLoanDueDate(id, date, month)
    } else {
      setDueDate(id, date, month)
    }
    setRefreshKey((k) => k + 1)
    onStatsChange?.()
  }

  function handleBalanceDueDateChange(id, date) {
    pinCurrentOrder()
    const isLoan = allItems.find((i) => i.id === id)?.isLoan
    if (isLoan) {
      setLoanBalanceDueDate(id, date, month)
    } else {
      setBalanceDueDate(id, date, month)
    }
    setRefreshKey((k) => k + 1)
  }

  function handleTargetMoveInChange(id, date) {
    pinCurrentOrder()
    setTargetMoveIn(id, date)
    setRefreshKey((k) => k + 1)
  }

  function handleFilterChange(status) {
    setPinned(null)
    setFilterStatus(status)
  }

  function handleSearchChange(query) {
    setPinned(null)
    setSearchQuery(query)
  }

  return (
    <div className="p-3 sm:p-6">
      <FilterBar
        activeFilter={filterStatus}
        onFilterChange={handleFilterChange}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
      />
      {allItems.length === 0 ? (
        <p className="text-gray-500 text-sm">
          {t('No units yet. Connect Google Drive to load your saved data, or add a unit under Manage Units below.')}
        </p>
      ) : filteredItems.length === 0 ? (
        <p className="text-gray-500 text-sm">{t('No units match this filter.')}</p>
      ) : (
        <div className="grid gap-2 sm:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredItems.map((unit) => (
            <UnitCard
              key={`${unit.id}-${month}-${refreshKey}`}
              unit={unit}
              insight={unit.isLoan ? undefined : insightMap.get(unit.payKey ?? unit.id)}
              onTogglePaid={handleTogglePaid}
              onRecordPayment={handleRecordPayment}
              onPaidDateChange={handlePaidDateChange}
              onDueDateChange={handleDueDateChange}
              onBalanceDueDateChange={handleBalanceDueDateChange}
              onTargetMoveInChange={handleTargetMoveInChange}
              onSelectMonth={onSelectMonth}
            />
          ))}
        </div>
      )}
      <div className="space-y-4 mt-6">
        <ManageUnits onChange={handleDataChange} />
        <ManageLoans onChange={handleDataChange} />
      </div>
    </div>
  )
}
