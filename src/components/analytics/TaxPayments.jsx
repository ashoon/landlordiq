import { useState } from 'react'
import {
  getTaxPayments,
  validateTaxPayment,
  addTaxPayment,
  deleteTaxPayment,
  addTaxFile,
  removeTaxFile,
} from '../../data/financials.js'
import { getTodayIso, formatDueDate } from '../../data/tenants.js'
import { formatCurrencyMil, milToAmount } from '../../data/currency.js'
import AttachmentList from '../common/AttachmentList.jsx'
import { t } from '../../data/i18n.js'

const inputCls =
  'w-full px-2 py-1.5 rounded border border-gray-300 text-sm text-gray-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-white'

function emptyForm() {
  return { year: String(new Date().getFullYear()), amount: '', paidDate: getTodayIso(), note: '' }
}

/**
 * TaxPayments — records the property tax, which is paid once a year. Each payment
 * counts as an expense in the month it was paid (so that month's net
 * operating income absorbs the full amount) and only one payment per tax year is allowed. The amount is
 * typed in COP mil (thousands): 3700 = COP 3,700,000.
 *
 * @param {{ onChange: () => void }} props
 */
export default function TaxPayments({ onChange }) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const payments = getTaxPayments()
  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  function submit(e) {
    e.preventDefault()
    const entry = { ...form, amount: milToAmount(form.amount) }
    const err = validateTaxPayment(entry)
    if (err) {
      setError(err)
      return
    }
    addTaxPayment(entry)
    setForm(emptyForm())
    setError('')
    onChange?.()
  }

  function remove(id) {
    deleteTaxPayment(id)
    onChange?.()
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700">{t('Annual Property Tax')}</h3>
      <p className="text-xs text-gray-500 mb-4">
        {t('Paid once a year. Counted as an expense in the month it was paid.')}
      </p>

      <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
        <label className="text-xs text-gray-500">
          {t('Tax year')}
          <input className={`mt-1 ${inputCls}`} type="number" value={form.year} onChange={setField('year')} />
        </label>
        <label className="text-xs text-gray-500">
          {t('Amount (COP mil)')}
          <input
            className={`mt-1 ${inputCls}`}
            type="number"
            min="0"
            step="any"
            value={form.amount}
            onChange={setField('amount')}
            placeholder={t('e.g. 3700')}
          />
        </label>
        <label className="text-xs text-gray-500">
          {t('Date paid')}
          <input className={`mt-1 ${inputCls}`} type="date" value={form.paidDate} onChange={setField('paidDate')} />
        </label>
        <label className="text-xs text-gray-500">
          {t('Note (optional)')}
          <input className={`mt-1 ${inputCls}`} value={form.note} onChange={setField('note')} placeholder={t('e.g. Predial')} />
        </label>
        <div className="col-span-2 md:col-span-4 flex items-center justify-between">
          <p className="text-sm text-red-500">{error}</p>
          <button
            type="submit"
            className="text-xs font-medium px-4 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-700"
          >
            {t('Record Tax Payment')}
          </button>
        </div>
      </form>

      {payments.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">{t('No tax payments recorded yet.')}</p>
      ) : (
        <ul className="mt-4 border-t border-gray-200 divide-y divide-gray-100">
          {payments.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium text-gray-900">{t('{year} tax', { year: p.year })}</span>
                <span className="block truncate text-xs text-gray-500">
                  {t('Paid')} {formatDueDate(p.paidDate)}
                  {p.note && ` · ${p.note}`}
                </span>
                <AttachmentList
                  files={p.attachments}
                  kind="receipts"
                  label={t('Attach receipt')}
                  onAdd={(ref) => {
                    addTaxFile(p.id, ref)
                    onChange?.()
                  }}
                  onRemove={(fileId) => {
                    removeTaxFile(p.id, fileId)
                    onChange?.()
                  }}
                />
              </span>
              <span className="flex items-center gap-3 whitespace-nowrap">
                <span className="font-medium text-gray-900">{formatCurrencyMil(p.amount)}</span>
                <button
                  onClick={() => remove(p.id)}
                  aria-label={`${t('Delete')} ${t('{year} tax', { year: p.year })}`}
                  className="text-xs text-red-500 hover:underline"
                >
                  {t('Delete')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
