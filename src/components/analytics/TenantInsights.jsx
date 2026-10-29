import { useState } from 'react'
import { getTenantInsights, isFlagged, GRACE_DAYS, WINDOW_MONTHS, FLAG_THRESHOLD } from '../../data/insights.js'
import { formatCurrency } from '../../data/currency.js'
import { t } from '../../data/i18n.js'

const thCls = 'px-3 py-2 font-medium'
const tdCls = 'px-3 py-2 text-gray-700 whitespace-nowrap'

/**
 * TenantInsights — table of how each tenant has paid over the last few months: months judged, late
 * months, average days late, months that started with a part payment, the balance still open, and
 * the "Pays late" / "Pays in parts" flags (shown under the tenant's name so they are visible on a phone without
 * scrolling sideways). Only the flagged tenants are listed at first; a button reveals everyone else.
 * Flagged tenants come first. The numbers come from
 * getTenantInsights() (src/data/insights.js); this component only presents them. The flag badges
 * use violet and sky on purpose, so they are never mistaken for a payment status colour.
 *
 * @param {{ month: string }} props - the selected month "YYYY-MM"; the window of months ends there
 */
export default function TenantInsights({ month }) {
  const [showAll, setShowAll] = useState(false)
  const all = getTenantInsights(month)
  const flaggedCount = all.filter(isFlagged).length
  // Flagged tenants come first, so showing "flagged only" keeps the same order
  const insights = showAll ? all : all.filter(isFlagged)
  const hasShortHistory = insights.some((i) => i.judged < WINDOW_MONTHS)

  return (
    <div className="bg-surface rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5">
      <h3 className="text-base font-semibold text-gray-900">{t('Tenant insights')}</h3>
      <p className="text-xs text-gray-500 mb-4">
        {t(
          'Late = the full rent arrived more than {days} days after the due date, or has not arrived yet. Looks at the last {months} months; a tenant is flagged at {count} or more.',
          { days: GRACE_DAYS, months: WINDOW_MONTHS, count: FLAG_THRESHOLD },
        )}
      </p>

      {all.length === 0 && <p className="text-sm text-gray-400">{t('No tenants to show yet.')}</p>}

      {all.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          aria-expanded={showAll}
          className="mb-3 text-xs font-medium px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          {showAll
            ? t('Show flagged tenants only ({count})', { count: flaggedCount })
            : t('Show all tenants ({count})', { count: all.length })}
        </button>
      )}

      {all.length > 0 && insights.length === 0 && (
        <p className="text-sm text-gray-500">{t('No tenants need watching right now.')}</p>
      )}

      {insights.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm" aria-label={t('Tenant insights')}>
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                  <th className={thCls}>{t('Tenant')}</th>
                  <th className={thCls}>{t('Months judged')}</th>
                  <th className={thCls}>{t('Late months')}</th>
                  <th className={thCls}>{t('Avg days late')}</th>
                  <th className={thCls}>{t('Part-payment months')}</th>
                  <th className={thCls}>{t('Balance owed')}</th>
                </tr>
              </thead>
              <tbody>
                {insights.map((i) => (
                  <tr key={i.tenantKey} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2 min-w-[9rem]">
                      <span className="block font-medium text-gray-900">{i.tenantName}</span>
                      <span className="block text-xs text-gray-500">{i.address}</span>
                      {(i.paysLate || i.paysInParts) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {i.paysLate && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 whitespace-nowrap">
                              {t('Pays late')}
                            </span>
                          )}
                          {i.paysInParts && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 whitespace-nowrap">
                              {t('Pays in parts')}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className={tdCls}>
                      {i.judged}
                      {i.judged < WINDOW_MONTHS && (
                        <span className="text-gray-400" title={t('Short history')}>
                          {' *'}
                        </span>
                      )}
                    </td>
                    <td className={tdCls}>{i.lateMonths}</td>
                    <td className={tdCls}>{i.avgDaysLate === null ? '–' : i.avgDaysLate}</td>
                    <td className={tdCls}>{i.partMonths}</td>
                    <td className={tdCls}>{i.balance > 0 ? formatCurrency(i.balance) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasShortHistory && (
            <p className="mt-3 text-xs text-gray-500">
              {t('* Fewer than {months} months of history. A low count may just mean little data.', {
                months: WINDOW_MONTHS,
              })}
            </p>
          )}
        </>
      )}
    </div>
  )
}
