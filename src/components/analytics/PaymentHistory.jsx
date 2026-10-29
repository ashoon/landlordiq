import { useState } from 'react'
import { getHistoryTenants, getPaymentHistory } from '../../data/paymentHistory.js'
import { formatDueDate } from '../../data/tenants.js'
import { formatCurrency } from '../../data/currency.js'
import { t, formatLocaleDate, capitalize } from '../../data/i18n.js'

const thCls = 'px-3 py-2 font-medium'
const tdCls = 'px-3 py-2 text-gray-700 whitespace-nowrap'

const statusStyles = {
  paid: 'text-green-500',
  'due-soon': 'text-amber-400',
  upcoming: 'text-gray-500',
  overdue: 'text-red-500',
}

/**
 * PaymentHistory — pick a tenant and see every month they owed rent: due date, amount paid, balance, the
 * payments received (date and amount) and how many days early or late the rent was fully paid. Months before the
 * tracking start are not listed. Former tenants can be picked too. The numbers come from getPaymentHistory()
 * (src/data/paymentHistory.js); this component only presents them.
 *
 * @param {{}} props - none; the tenant is chosen inside the component
 */
export default function PaymentHistory() {
  const tenants = getHistoryTenants()
  const [picked, setPicked] = useState('')
  const selected = tenants.find((x) => x.key === picked) ?? tenants[0]
  const history = selected ? getPaymentHistory(selected.key) : null

  const statusLabels = {
    paid: t('Paid'),
    'due-soon': t('Due Soon'),
    upcoming: t('Upcoming'),
    overdue: t('Overdue'),
  }

  function describeTiming(days) {
    if (days === null) return '–'
    if (days === 0) return t('On the due date')
    const n = Math.abs(days)
    if (days < 0) return n === 1 ? t('1 day early') : t('{n} days early', { n })
    return n === 1 ? t('1 day late') : t('{n} days late', { n })
  }

  function monthLabel(key) {
    const [y, m] = key.split('-').map(Number)
    return capitalize(formatLocaleDate(new Date(y, m - 1, 1), { month: 'short', year: 'numeric' }))
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700">{t('Payment history by tenant')}</h3>
      <p className="text-xs text-gray-500 mb-4">
        {t('Every month the tenant owed rent, from when tracking started. Pick a tenant to see what they paid and when.')}
      </p>

      {tenants.length === 0 ? (
        <p className="text-sm text-gray-400">{t('No tenants to show yet.')}</p>
      ) : (
        <>
          <label className="block text-xs text-gray-500 max-w-md">
            {t('Tenant')}
            <select
              className="mt-1 w-full px-2 py-1.5 rounded border border-gray-300 text-sm text-gray-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-white"
              value={selected.key}
              onChange={(e) => setPicked(e.target.value)}
            >
              {tenants.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.tenantName} · {x.address}
                  {x.former ? ` (${t('moved out')})` : ''}
                </option>
              ))}
            </select>
          </label>

          <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <dt className="text-xs text-gray-500">{t('Months')}</dt>
              <dd className="font-medium text-gray-900">{history.totals.months}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">{t('Total paid')}</dt>
              <dd className="font-medium text-gray-900">{formatCurrency(history.totals.paid)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">{t('Past-due balance')}</dt>
              <dd className="font-medium text-gray-900">
                {history.totals.owed > 0 ? formatCurrency(history.totals.owed) : '–'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">{t('Paid after the due date')}</dt>
              <dd className="font-medium text-gray-900">
                {t('{n} of {total} months', { n: history.totals.lateMonths, total: history.totals.months })}
              </dd>
            </div>
          </dl>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm" aria-label={t('Payment history by tenant')}>
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                  <th className={thCls}>{t('Month')}</th>
                  <th className={thCls}>{t('Due')}</th>
                  <th className={`${thCls} text-right`}>{t('Rent')}</th>
                  <th className={`${thCls} text-right`}>{t('Paid')}</th>
                  <th className={`${thCls} text-right`}>{t('Balance')}</th>
                  <th className={thCls}>{t('Payments received')}</th>
                  <th className={thCls}>{t('Paid in full')}</th>
                </tr>
              </thead>
              <tbody>
                {history.rows.map((r) => (
                  <tr key={r.month} className="border-b border-gray-100 last:border-0 align-top">
                    <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{monthLabel(r.month)}</td>
                    <td className={tdCls}>{formatDueDate(r.dueDate)}</td>
                    <td className={`${tdCls} text-right`}>{formatCurrency(r.rentAmount)}</td>
                    <td className={`${tdCls} text-right`}>{r.amountPaid > 0 ? formatCurrency(r.amountPaid) : '–'}</td>
                    <td className={`${tdCls} text-right font-medium ${r.balance > 0 ? statusStyles[r.status] : 'text-gray-700'}`}>
                      {r.balance > 0 ? formatCurrency(r.balance) : '–'}
                    </td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                      {r.payments.length === 0
                        ? '–'
                        : r.payments.map((p) => (
                            <span key={p.id} className="block text-xs">
                              {p.date ? formatDueDate(p.date) : t('Earlier')} · {formatCurrency(p.amount)}
                            </span>
                          ))}
                    </td>
                    <td className={tdCls}>
                      {r.daysFromDue !== null ? (
                        <span className={`font-medium ${r.daysFromDue > 0 ? 'text-gray-700' : statusStyles.paid}`}>
                          {describeTiming(r.daysFromDue)}
                        </span>
                      ) : (
                        <span className={`font-medium ${statusStyles[r.status]}`}>{statusLabels[r.status]}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
