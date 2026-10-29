import { getMaintenanceByAddress } from '../../data/financials.js'
import { formatCurrency } from '../../data/currency.js'
import { t } from '../../data/i18n.js'

const thCls = 'px-3 py-2 font-medium'
const tdCls = 'px-3 py-2 text-gray-700 whitespace-nowrap'

/**
 * MaintenanceByAddress — table of maintenance spending per address: the selected month and the whole
 * calendar year it falls in, biggest yearly total first. Expenses that were not linked to a unit are
 * grouped in one last "Not linked to a unit" row. The numbers come from getMaintenanceByAddress()
 * (src/data/financials.js); this component only presents them.
 *
 * @param {{ month: string }} props - the selected month "YYYY-MM"
 */
export default function MaintenanceByAddress({ month }) {
  const rows = getMaintenanceByAddress(month)
  const year = month.slice(0, 4)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700">{t('Maintenance by Address')}</h3>
      <p className="text-xs text-gray-500 mb-4">
        {t('Which address has cost the most in repairs. Link an expense to a unit when you log it.')}
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">{t('No maintenance expenses logged for {year} yet.', { year })}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-sm" aria-label={t('Maintenance by Address')}>
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                <th className={thCls}>{t('Address')}</th>
                <th className={`${thCls} text-right`}>{t('This month')}</th>
                <th className={`${thCls} text-right`}>{t('Year {year}', { year })}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.address ?? 'unlinked'} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {r.address ?? <span className="font-normal text-gray-500">{t('Not linked to a unit')}</span>}
                  </td>
                  <td className={`${tdCls} text-right`}>{r.month > 0 ? formatCurrency(r.month) : '–'}</td>
                  <td className={`${tdCls} text-right font-medium text-gray-900`}>{formatCurrency(r.year)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
