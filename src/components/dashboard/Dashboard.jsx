import { useState, useMemo } from 'react'
import { getAllTenants, setPaymentStatus, setPaidDate, setDueDate } from '../../data/tenants.js'
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

  // Re-reads the store on every render cycle that needs it
  const allTenants = getAllTenants(month)

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
  }, [filterStatus, searchQuery, refreshKey, month])

  function handleUnitsChange() {
    setRefreshKey((k) => k + 1)
    onStatsChange?.()
  }

  function handleTogglePaid(id, paid) {
    setPaymentStatus(id, paid, month)
    setRefreshKey((k) => k + 1)
    onStatsChange?.()
  }

  function handlePaidDateChange(id, date) {
    setPaidDate(id, date, month)
    setRefreshKey((k) => k + 1)
    onStatsChange?.()
  }

  function handleDueDateChange(id, date) {
    setDueDate(id, date, month)
    setRefreshKey((k) => k + 1)
    onStatsChange?.()
  }

  return (
    <div className="p-4 sm:p-6">
      <FilterBar
        activeFilter={filterStatus}
        onFilterChange={setFilterStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      {allTenants.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No units yet. Connect Google Drive to load your saved data, or add a unit under Manage Units below.
        </p>
      ) : tenants.length === 0 ? (
        <p className="text-gray-500 text-sm">No units match this filter.</p>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
