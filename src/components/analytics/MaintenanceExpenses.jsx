import { useState } from 'react'
import {
  EXPENSE_CATEGORIES,
  getExpenses,
  validateExpense,
  addExpense,
  deleteExpense,
} from '../../data/financials.js'
import { formatCurrencyMil, milToAmount } from '../../data/currency.js'

const EMPTY_FORM = { category: EXPENSE_CATEGORIES[0], amount: '', note: '' }

const inputCls =
  'w-full px-2 py-1.5 rounded border border-gray-300 text-sm text-gray-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-white'

/**
 * MaintenanceExpenses — form and list for logging maintenance expenses against the
 * selected month. Entries are added to that month's maintenance costs, so the pie
 * chart and KPIs update immediately.
 *
 * The amount is typed in COP mil (thousands): 450 = COP 450,000.
 *
 * @param {{ month: string, onChange: () => void }} props - month is "YYYY-MM"
 */
export default function MaintenanceExpenses({ month, onChange }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  const expenses = getExpenses(month)
  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  function submit(e) {
    e.preventDefault()
    const entry = { ...form, amount: milToAmount(form.amount) }
    const err = validateExpense(entry)
    if (err) {
      setError(err)
      return
    }
    addExpense(month, entry)
    setForm((f) => ({ ...EMPTY_FORM, category: f.category }))
    setError('')
    onChange?.()
  }

  function remove(id) {
    deleteExpense(id)
    onChange?.()
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700">Add Maintenance Expense</h3>
      <p className="text-xs text-gray-500 mb-4">Logged against {monthLabel}</p>

      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <label className="text-xs text-gray-500">
          Category
          <select className={`mt-1 ${inputCls}`} value={form.category} onChange={setField('category')}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          Amount (COP mil)
          <input
            className={`mt-1 ${inputCls}`}
            type="number"
            min="0"
            step="any"
            value={form.amount}
            onChange={setField('amount')}
            placeholder="e.g. 450"
          />
        </label>
        <label className="col-span-2 text-xs text-gray-500">
          Note (optional)
          <input
            className={`mt-1 ${inputCls}`}
            value={form.note}
            onChange={setField('note')}
            placeholder="e.g. Unit 304 leaking faucet"
          />
        </label>
        <div className="col-span-2 flex items-center justify-between">
          <p className="text-sm text-red-500">{error}</p>
          <button
            type="submit"
            className="text-xs font-medium px-4 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-700"
          >
            Add Expense
          </button>
        </div>
      </form>

      {expenses.length > 0 && (
        <ul className="mt-4 border-t border-gray-200 divide-y divide-gray-100 max-h-48 overflow-y-auto">
          {expenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium text-gray-900">{e.category}</span>
                {e.note && <span className="block truncate text-xs text-gray-500">{e.note}</span>}
              </span>
              <span className="flex items-center gap-3 whitespace-nowrap">
                <span className="font-medium text-gray-900">{formatCurrencyMil(e.amount)}</span>
                <button
                  onClick={() => remove(e.id)}
                  aria-label={`Delete ${e.category} expense`}
                  className="text-xs text-red-500 hover:underline"
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
