import { getAvailableMonths } from '../../data/tenants.js'
import { t, formatToday } from '../../data/i18n.js'
import DriveStatus from './DriveStatus.jsx'
import LanguageSwitcher from './LanguageSwitcher.jsx'
import ThemeSwitcher from './ThemeSwitcher.jsx'
import { inputCls } from '../common/ui.js'

/**
 * Header — property name and today's date on the left; on the right one row of controls: language flags,
 * dark-mode toggle, Google Drive sync status, month picker. The two tabs sit below as a segmented control.
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

  const tabs = [
    { id: 'dashboard', short: t('Units'), long: t('Units Dashboard') },
    { id: 'analytics', short: t('Analytics'), long: t('Financial Analytics') },
  ]

  return (
    <header className="bg-surface border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Landlord<span className="text-brand-600">IQ</span>
          </h1>
          <p className="text-sm text-gray-500">{today}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <LanguageSwitcher />
          <ThemeSwitcher />
          <DriveStatus />
          <select
            value={selectedMonth}
            onChange={(e) => onMonthChange(e.target.value)}
            aria-label={t('Select month')}
            className={`${inputCls} w-auto min-w-0 py-2`}
          >
            {getAvailableMonths().map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <nav className="flex gap-1 p-1 rounded-lg bg-gray-100 md:w-fit" aria-label={t('Views')}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="sm:hidden">{tab.short}</span>
            <span className="hidden sm:inline">{tab.long}</span>
          </button>
        ))}
      </nav>
    </header>
  )
}
