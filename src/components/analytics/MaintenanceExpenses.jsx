import { useState, useSyncExternalStore } from 'react'
import {
  EXPENSE_CATEGORIES,
  getExpenses,
  getExpenseUnitOptions,
  getExpenseAddress,
  validateExpense,
  addExpense,
  deleteExpense,
  addExpenseFile,
  removeExpenseFile,
} from '../../data/financials.js'
import { formatCurrencyMil, milToAmount } from '../../data/currency.js'
import AttachmentList from '../common/AttachmentList.jsx'
import {
  ACCEPTED_TYPES,
  validateAttachment,
  uploadFile,
  isUploadAvailable,
  describeAttachmentError,
  getStatus,
  subscribeStatus,
} from '../../data/attachments.js'
import { t, formatLocaleDate, capitalize } from '../../data/i18n.js'

const EMPTY_FORM = { category: EXPENSE_CATEGORIES[0], unitId: '', amount: '', note: '' }

const inputCls =
  'w-full px-2 py-1.5 rounded border border-gray-300 text-sm text-gray-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-white'

/**
 * MaintenanceExpenses — form and list for logging maintenance expenses against the
 * selected month. Entries are added to that month's maintenance costs, so the pie
 * chart and KPIs update immediately.
 *
 * The amount is typed in COP mil (thousands): 450 = COP 450,000.
 * An expense can optionally be linked to a unit (address); those feed the "by address" table.
 *
 * @param {{ month: string, onChange: () => void }} props - month is "YYYY-MM"
 */
export default function MaintenanceExpenses({ month, onChange }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState(null)
  // Changing the key empties the file input after a save
  const [receiptKey, setReceiptKey] = useState(0)
  const [saving, setSaving] = useState(false)
  useSyncExternalStore(subscribeStatus, getStatus)
  const canAttach = isUploadAvailable()

  const expenses = getExpenses(month)
  const unitOptions = getExpenseUnitOptions()
  const monthLabel = capitalize(
    formatLocaleDate(new Date(`${month}-01T00:00:00`), {
      month: 'long',
      year: 'numeric',
    }),
  )

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  function pickReceipt(e) {
    const file = e.target.files?.[0] ?? null
    const problem = file ? validateAttachment(file) : ''
    if (problem) {
      setError(t(problem))
      e.target.value = ''
      setReceipt(null)
      return
    }
    setError('')
    setReceipt(file)
  }

  async function submit(e) {
    e.preventDefault()
    const entry = { ...form, amount: milToAmount(form.amount) }
    const err = validateExpense(entry)
    if (err) {
      setError(err)
      return
    }
    // The expense is saved first, so a failed upload never loses it
    const id = addExpense(month, entry)
    const file = receipt
    setForm((f) => ({ ...EMPTY_FORM, category: f.category, unitId: f.unitId }))
    setReceipt(null)
    setReceiptKey((k) => k + 1)
    setError('')
    onChange?.()
    if (!file) return
    setSaving(true)
    try {
      addExpenseFile(id, await uploadFile(file, 'receipts'))
    } catch (uploadError) {
      setError(`${t('Expense saved, but the receipt was not uploaded.')} ${describeAttachmentError(uploadError)}`)
    } finally {
      setSaving(false)
      onChange?.()
    }
  }

  function remove(id) {
    deleteExpense(id)
    onChange?.()
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700">{t('Add Maintenance Expense')}</h3>
      <p className="text-xs text-gray-500 mb-4">{t('Logged against')} {monthLabel}</p>

      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <label className="text-xs text-gray-500">
          {t('Category')}
          <select className={`mt-1 ${inputCls}`} value={form.category} onChange={setField('category')}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          {t('Unit (optional)')}
          <select className={`mt-1 ${inputCls}`} value={form.unitId} onChange={setField('unitId')}>
            <option value="">{t('Not linked to a unit')}</option>
            {unitOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 text-xs text-gray-500">
          {t('Amount (COP mil)')}
          <input
            className={`mt-1 ${inputCls}`}
            type="number"
            min="0"
            step="any"
            value={form.amount}
            onChange={setField('amount')}
            placeholder={t('e.g. 450')}
          />
        </label>
        <label className="col-span-2 text-xs text-gray-500">
          {t('Note (optional)')}
          <input
            className={`mt-1 ${inputCls}`}
            value={form.note}
            onChange={setField('note')}
            placeholder={t('e.g. Unit 304 leaking faucet')}
          />
        </label>
        <label className="col-span-2 text-xs text-gray-500">
          {t('Receipt photo or PDF (optional)')}
          <input
            key={receiptKey}
            className={`mt-1 ${inputCls} disabled:opacity-40`}
            type="file"
            accept={ACCEPTED_TYPES}
            disabled={!canAttach || saving}
            onChange={pickReceipt}
          />
          {!canAttach && <span className="block mt-1 text-gray-400">{t('Connect Google Drive to attach or open files.')}</span>}
        </label>
        <div className="col-span-2 flex items-center justify-between">
          <p className="text-sm text-red-500">{error}</p>
          <button
            type="submit"
            disabled={saving}
            className="text-xs font-medium px-4 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40"
          >
            {saving ? t('Uploading…') : t('Add Expense')}
          </button>
        </div>
      </form>

      {expenses.length > 0 && (
        <ul className="mt-4 border-t border-gray-200 divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {expenses.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium text-gray-900">{t(e.category)}</span>
                {getExpenseAddress(e) && <span className="text-gray-500"> · {getExpenseAddress(e)}</span>}
                {e.note && <span className="block truncate text-xs text-gray-500">{e.note}</span>}
                <AttachmentList
                  files={e.attachments}
                  kind="receipts"
                  label={t('Attach receipt')}
                  onAdd={(ref) => {
                    addExpenseFile(e.id, ref)
                    onChange?.()
                  }}
                  onRemove={(fileId) => {
                    removeExpenseFile(e.id, fileId)
                    onChange?.()
                  }}
                />
              </span>
              <span className="flex items-center gap-3 whitespace-nowrap">
                <span className="font-medium text-gray-900">{formatCurrencyMil(e.amount)}</span>
                <button
                  onClick={() => remove(e.id)}
                  aria-label={`${t('Delete')} ${t(e.category)}`}
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
