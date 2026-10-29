import { getSummaryStats } from '../../data/tenants.js'
import { formatCurrencyMil } from '../../data/currency.js'
import { t } from '../../data/i18n.js'

/**
 * SummaryStrip — shows aggregate counts and rent totals for the dashboard tab.
 *
 * @param {{ refreshKey: number, month: string }} props
 */
export default function SummaryStrip({ refreshKey, month }) {
  // refreshKey is incremented by Dashboard when a toggle occurs, causing re-read
  void refreshKey
  const stats = getSummaryStats(month)

  return (
    <div className="bg-gray-50 border-b border-gray-200 px-4 sm:px-6 py-3 flex flex-wrap gap-x-4 gap-y-1 sm:gap-x-6 text-sm">
      <span className="text-gray-600">
        <span className="font-semibold text-gray-900">{stats.total}</span> {t('Total Units')}
      </span>
      <span className="text-green-700">
        <span className="font-semibold">{stats.paid}</span> {t('Paid')}
      </span>
      <span className="text-amber-600">
        <span className="font-semibold">{stats.dueSoon}</span> {t('Due Soon')}
      </span>
      <span className="text-gray-500">
        <span className="font-semibold">{stats.upcoming}</span> {t('Upcoming')}
      </span>
      <span className="text-red-600">
        <span className="font-semibold">{stats.overdue}</span> {t('Overdue')}
      </span>
      <span className="text-gray-500">
        <span className="font-semibold">{stats.vacant}</span> {t('Vacant')}
      </span>
      <span className="w-full sm:w-auto sm:ml-auto text-gray-600">
        {t('Collected:')}{' '}
        <span className="font-semibold text-gray-900">{formatCurrencyMil(stats.totalCollected)}</span>
        {' / '}
        {formatCurrencyMil(stats.totalExpected)} {t('expected')}
        {stats.vacancyLoss > 0 && (
          <span className="ml-3 text-gray-500 whitespace-nowrap">
            {t('Vacancy loss:')} {formatCurrencyMil(stats.vacancyLoss)}
          </span>
        )}
      </span>
    </div>
  )
}
