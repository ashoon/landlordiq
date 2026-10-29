import { t } from '../../data/i18n.js'

/**
 * FilterBar — status filter buttons and unit number search for the unit grid.
 *
 * @param {{
 *   activeFilter: string,
 *   onFilterChange: (filter: string) => void,
 *   searchQuery: string,
 *   onSearchChange: (query: string) => void,
 * }} props
 */
export default function FilterBar({ activeFilter, onFilterChange, searchQuery, onSearchChange }) {
  const filters = [
    { value: 'all', label: t('All') },
    { value: 'paid', label: t('Paid') },
    { value: 'due-soon', label: t('Due Soon') },
    { value: 'upcoming', label: t('Upcoming') },
    { value: 'overdue', label: t('Overdue') },
    { value: 'vacant', label: t('Vacant') },
  ]

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              activeFilter === f.value
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative w-full sm:w-auto sm:ml-auto">
        <span className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('Search address, tenant or phone…')}
          className="pl-8 pr-3 py-1.5 rounded-full border border-gray-300 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-white w-full sm:w-80"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            aria-label={t('Clear search')}
            className="absolute inset-y-0 right-2.5 flex items-center text-gray-400 hover:text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
