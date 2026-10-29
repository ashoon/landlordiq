import { getAvailableMonths } from '../../data/tenants.js'
import { t, formatToday } from '../../data/i18n.js'
import DriveStatus from './DriveStatus.jsx'
import LanguageSwitcher from './LanguageSwitcher.jsx'

/**
 * Header — property name, today's date, language flags, Google Drive sync status, month picker, and tab switcher.
 *
 * @param {{
 *   activeTab: string,
 *   onTabChange: (tab: string) => void,
 *   selectedMonth: string,
 *   onMonthChange: (month: string) => void,
 * }} props
 */
export default function Header({ activeTab, onTabChange, selectedMonth, onMonthChange }) {
  const today = formatToday()

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900">LandlordIQ</h1>
          <p className="text-sm text-gray-500">{today}</p>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <LanguageSwitcher />
          <DriveStatus />
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden md:flex md:items-center md:gap-4">
          <LanguageSwitcher />
          <DriveStatus />
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          aria-label={t('Select month')}
          className="min-w-0 px-3 py-2 rounded border border-gray-300 bg-white text-sm text-gray-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        >
          {getAvailableMonths().map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <nav className="flex flex-1 gap-1 sm:gap-2 md:flex-none">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`flex-1 md:flex-none px-3 sm:px-4 py-2 rounded text-sm font-medium transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="sm:hidden">{t('Units')}</span>
            <span className="hidden sm:inline">{t('Units Dashboard')}</span>
          </button>
          <button
            onClick={() => onTabChange('analytics')}
            className={`flex-1 md:flex-none px-3 sm:px-4 py-2 rounded text-sm font-medium transition-colors ${
              activeTab === 'analytics'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="sm:hidden">{t('Analytics')}</span>
            <span className="hidden sm:inline">{t('Financial Analytics')}</span>
          </button>
        </nav>
      </div>
    </header>
  )
}
