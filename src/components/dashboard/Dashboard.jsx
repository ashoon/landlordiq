import { useState, useMemo } from 'react'
import {
  getAllTenants,
  setPaymentStatus,
  setPaidDate,
  setDueDate,
  sortByOrder,
  idsWithFirstInStatus,
} from '../../data/tenants.js'
import FilterBar from './FilterBar.jsx'
import UnitCard from './UnitCard.jsx'
import ManageUnits from './ManageUnits.jsx'

/**
 * Dashboard — orchestrates the filter state, search, unit card grid, and unit management section.
 *
 * @param {{ month: string, onStatsChange: () => void }} props
 */
export default function Dashboard({ month, onStatsChange }) {
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

  // Re-reads the store on every render cycle that needs it
  const freshTenants = getAllTenants(month)
  const allTenants = pinned && pinned.month === month ? sortByOrder(freshTenants, pinned.ids) : freshTenants

  const tenants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return allTenants.filter((t) => {
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

  function handleUnitsChange() {
    setPinned(null)
    setRefreshKey((k) => k + 1)
    onStatsChange?.()
  }

  function handleTogglePaid(id, paid) {
    setPaymentStatus(id, paid, month)
    // Marked paid: the tile goes to the first spot of the paid section. Marked unpaid: normal sort.
    if (paid) {
      const fresh = getAllTenants(month)
      const current = pinned ? sortByOrder(fresh, pinned.ids) : fresh
      setPinned({ month, ids: idsWithFirstInStatus(current, id) })
    } else {
      setPinned(null)
    }
    setRefreshKey((k) => k + 1)
    onStatsChange?.()
  }

  // Keeps the order shown now (set once, so several edits in a row don't reshuffle either)
  function pinCurrentOrder() {
    setPinned((p) => (p && p.month === month ? p : { month, ids: allTenants.map((t) => t.id) }))
  }

  function handlePaidDateChange(id, date) {
    pinCurrentOrder()
    setPaidDate(id, date, month)
    setRefreshKey((k) => k + 1)
    onStatsChange?.()
  }

  function handleDueDateChange(id, date) {
    pinCurrentOrder()
    setDueDate(id, date, month)
    setRefreshKey((k) => k + 1)
    onStatsChange?.()
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
      {allTenants.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No units yet. Connect Google Drive to load your saved data, or add a unit under Manage Units below.
        </p>
      ) : tenants.length === 0 ? (
        <p className="text-gray-500 text-sm">No units match this filter.</p>
      ) : (
        <div className="grid gap-2 sm:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {tenants.map((unit) => (
            <UnitCard
              key={`${unit.id}-${month}-${refreshKey}`}
              unit={unit}
              onTogglePaid={handleTogglePaid}
              onPaidDateChange={handlePaidDateChange}
              onDueDateChange={handleDueDateChange}
            />
          ))}
        </div>
      )}
      <ManageUnits onChange={handleUnitsChange} />
    </div>
  )
}
