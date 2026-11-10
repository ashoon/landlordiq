import { useState } from 'react'
import {
  getLoans,
  addLoan,
  updateLoan,
  deleteLoan,
  settleLoan,
  reactivateLoan,
  validateLoan,
} from '../../data/loans.js'
import { getTodayIso, formatDueDate } from '../../data/tenants.js'
import { formatCurrency, milToAmount, amountToMil } from '../../data/currency.js'
import { t, getLanguage } from '../../data/i18n.js'
import { inputCls, btnCls } from '../common/ui.js'

const EMPTY_FORM = {
  borrowerName: '',
  phone: '',
  principalMil: '',
  monthlyMil: '',
  dueDay: '30',
  startDate: '',
  capitalDueDate: '',
  note: '',
}

/** Returns "1st", "2nd", "3rd", "4th"… for a day of the month (plain "1", "2"… in Spanish). */
function ordinal(n) {
  if (getLanguage() === 'es') return String(n)
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

/**
 * ManageLoans — collapsible section at the bottom of the dashboard for managing loans given
 * to individuals (principal, monthly interest/installment, due day, capital repayment date, notes).
 *
 * @param {{ onChange?: () => void }} props
 */
export default function ManageLoans({ onChange }) {
  const [open, setOpen] = useState(false)
  const [version, setVersion] = useState(0)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  void version
  const loans = getLoans()

  function begin(id, nextForm) {
    setEditingId(id)
    setForm(nextForm)
    setError('')
  }

  const startAdd = () =>
    begin('new', {
      ...EMPTY_FORM,
      startDate: getTodayIso(),
      dueDay: '30',
    })

  const startEdit = (loan) =>
    begin(loan.id, {
      borrowerName: loan.borrowerName,
      phone: loan.phone,
      principalMil: String(amountToMil(loan.principalAmount)),
      monthlyMil: String(amountToMil(loan.monthlyAmount)),
      dueDay: String(loan.dueDay),
      startDate: loan.startDate ?? '',
      capitalDueDate: loan.capitalDueDate ?? '',
      note: loan.note ?? '',
    })

  function cancel() {
    setEditingId(null)
    setError('')
  }

  function commit() {
    onChange?.()
    setVersion((v) => v + 1)
  }

  function finish() {
    setEditingId(null)
    setError('')
    commit()
  }

  function handleSave(e) {
    e.preventDefault()
    const principal = milToAmount(form.principalMil)
    const monthly =
      form.monthlyMil === '' || form.monthlyMil === '0' || Number(form.monthlyMil) === 0
        ? 0
        : milToAmount(form.monthlyMil)
    const dueDay = Number(form.dueDay || 30)

    const payload = {
      borrowerName: form.borrowerName,
      phone: form.phone,
      principalAmount: principal,
      monthlyAmount: monthly,
      dueDay,
      startDate: form.startDate,
      capitalDueDate: form.capitalDueDate,
      note: form.note,
    }

    const validationError = validateLoan(payload)
    if (validationError) {
      setError(validationError)
      return
    }

    try {
      if (editingId === 'new') {
        addLoan(payload)
      } else {
        updateLoan(editingId, payload)
      }
      finish()
    } catch (err) {
      setError(err.message)
    }
  }

  function handleDelete(id, name) {
    if (window.confirm(t('Delete loan for "{name}"?', { name }))) {
      deleteLoan(id)
      commit()
    }
  }

  function handleSettle(id) {
    settleLoan(id)
    commit()
  }

  function handleReactivate(id) {
    reactivateLoan(id)
    commit()
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-surface shadow-xs transition-colors overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 sm:px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-90' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clipRule="evenodd"
            />
          </svg>
          <h2 className="text-base font-semibold text-gray-900">{t('Loans Given')}</h2>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {loans.length}
          </span>
        </div>
        <span className="text-xs font-medium text-brand-600">
          {open ? t('Hide') : t('Manage')}
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-200 px-4 sm:px-6 py-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              {t('Track loans given to individuals, monthly installment/interest due dates, and capital repayments.')}
            </p>
            {editingId !== 'new' && (
              <button
                type="button"
                onClick={startAdd}
                className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-md bg-brand-600 text-white hover:bg-brand-700 transition-colors"
              >
                + {t('Add Loan')}
              </button>
            )}
          </div>

          {editingId === 'new' && (
            <form onSubmit={handleSave} className="rounded-lg border border-brand-200 bg-brand-50/40 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">{t('New Loan')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <label className="text-xs font-medium text-gray-700">
                  {t('Borrower Name')} *
                  <input
                    type="text"
                    required
                    value={form.borrowerName}
                    onChange={(e) => setForm({ ...form, borrowerName: e.target.value })}
                    className={inputCls}
                    placeholder={t('e.g. Carlos Gomez')}
                  />
                </label>
                <label className="text-xs font-medium text-gray-700">
                  {t('Phone')}
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={inputCls}
                    placeholder="300 123 4567"
                  />
                </label>
                <label className="text-xs font-medium text-gray-700">
                  {t('Capital / Principal (COP mil)')} *
                  <input
                    type="number"
                    step="5"
                    min="0"
                    required
                    value={form.principalMil}
                    onChange={(e) => setForm({ ...form, principalMil: e.target.value })}
                    className={inputCls}
                    placeholder={t('e.g. 4700')}
                  />
                </label>
                <label className="text-xs font-medium text-gray-700">
                  {t('Monthly Payment / Interest (COP mil, 0 for zero interest)')}
                  <input
                    type="number"
                    step="5"
                    min="0"
                    value={form.monthlyMil}
                    onChange={(e) => setForm({ ...form, monthlyMil: e.target.value })}
                    className={inputCls}
                    placeholder={t('e.g. 350 or 0')}
                  />
                </label>
                <label className="text-xs font-medium text-gray-700">
                  {t('Monthly Due Day')} (1–31) *
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={form.dueDay}
                    onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
                    className={inputCls}
                    placeholder="30"
                  />
                </label>
                <label className="text-xs font-medium text-gray-700">
                  {t('Loan Date')}
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className={inputCls}
                  />
                </label>
                <label className="text-xs font-medium text-gray-700">
                  {t('Capital Due Date (optional)')}
                  <input
                    type="date"
                    value={form.capitalDueDate}
                    onChange={(e) => setForm({ ...form, capitalDueDate: e.target.value })}
                    className={inputCls}
                  />
                </label>
                <label className="text-xs font-medium text-gray-700 sm:col-span-2">
                  {t('Note')}
                  <input
                    type="text"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    className={inputCls}
                    placeholder={t('Optional notes...')}
                  />
                </label>
              </div>

              {error && <p className="text-xs font-medium text-red-600">{error}</p>}

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={cancel}
                  className="text-xs font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  className="text-xs font-medium px-3 py-1.5 rounded-md bg-brand-600 text-white hover:bg-brand-700"
                >
                  {t('Save Loan')}
                </button>
              </div>
            </form>
          )}

          {loans.length === 0 && editingId !== 'new' && (
            <p className="text-xs text-gray-400 py-3 text-center">{t('No loans recorded yet.')}</p>
          )}

          {loans.length > 0 && (
            <div className="space-y-3">
              {loans.map((loan) => {
                const isEditing = editingId === loan.id
                const isSettled = loan.status === 'settled'

                if (isEditing) {
                  return (
                    <form
                      key={loan.id}
                      onSubmit={handleSave}
                      className="rounded-lg border border-brand-200 bg-brand-50/40 p-4 space-y-3"
                    >
                      <h3 className="text-sm font-semibold text-gray-900">{t('Edit Loan')}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <label className="text-xs font-medium text-gray-700">
                          {t('Borrower Name')} *
                          <input
                            type="text"
                            required
                            value={form.borrowerName}
                            onChange={(e) => setForm({ ...form, borrowerName: e.target.value })}
                            className={inputCls}
                          />
                        </label>
                        <label className="text-xs font-medium text-gray-700">
                          {t('Phone')}
                          <input
                            type="tel"
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            className={inputCls}
                          />
                        </label>
                        <label className="text-xs font-medium text-gray-700">
                          {t('Capital / Principal (COP mil)')} *
                          <input
                            type="number"
                            step="5"
                            min="0"
                            required
                            value={form.principalMil}
                            onChange={(e) => setForm({ ...form, principalMil: e.target.value })}
                            className={inputCls}
                          />
                        </label>
                        <label className="text-xs font-medium text-gray-700">
                          {t('Monthly Payment / Interest (COP mil, 0 for zero interest)')}
                          <input
                            type="number"
                            step="5"
                            min="0"
                            value={form.monthlyMil}
                            onChange={(e) => setForm({ ...form, monthlyMil: e.target.value })}
                            className={inputCls}
                            placeholder={t('e.g. 350 or 0')}
                          />
                        </label>
                        <label className="text-xs font-medium text-gray-700">
                          {t('Monthly Due Day')} (1–31) *
                          <input
                            type="number"
                            min="1"
                            max="31"
                            required
                            value={form.dueDay}
                            onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
                            className={inputCls}
                          />
                        </label>
                        <label className="text-xs font-medium text-gray-700">
                          {t('Loan Date')}
                          <input
                            type="date"
                            value={form.startDate}
                            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                            className={inputCls}
                          />
                        </label>
                        <label className="text-xs font-medium text-gray-700">
                          {t('Capital Due Date (optional)')}
                          <input
                            type="date"
                            value={form.capitalDueDate}
                            onChange={(e) => setForm({ ...form, capitalDueDate: e.target.value })}
                            className={inputCls}
                          />
                        </label>
                        <label className="text-xs font-medium text-gray-700 sm:col-span-2">
                          {t('Note')}
                          <input
                            type="text"
                            value={form.note}
                            onChange={(e) => setForm({ ...form, note: e.target.value })}
                            className={inputCls}
                          />
                        </label>
                      </div>

                      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={cancel}
                          className="text-xs font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
                        >
                          {t('Cancel')}
                        </button>
                        <button
                          type="submit"
                          className="text-xs font-medium px-3 py-1.5 rounded-md bg-brand-600 text-white hover:bg-brand-700"
                        >
                          {t('Save Changes')}
                        </button>
                      </div>
                    </form>
                  )
                }

                return (
                  <div
                    key={loan.id}
                    className={`rounded-lg border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSettled ? 'border-gray-200 bg-gray-50 opacity-70' : 'border-gray-200 bg-surface'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900">{loan.borrowerName}</span>
                        {loan.phone && <span className="text-xs text-gray-500">{loan.phone}</span>}
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            isSettled ? 'bg-gray-200 text-gray-700' : 'bg-brand-100 text-brand-800'
                          }`}
                        >
                          {isSettled ? t('Settled (Capital Repaid)') : t('Active')}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-0.5">
                        <span>
                          <strong className="text-gray-900">{t('Capital')}:</strong>{' '}
                          {formatCurrency(loan.principalAmount)}
                        </span>
                        <span>
                          <strong className="text-gray-900">{t('Monthly payment')}:</strong>{' '}
                          {loan.monthlyAmount === 0
                            ? `COP 0 (${t('Zero interest')})`
                            : `${formatCurrency(loan.monthlyAmount)} (${t('Due day')}: ${ordinal(loan.dueDay)})`}
                        </span>
                        {loan.startDate && (
                          <span>
                            <strong className="text-gray-900">{t('Given')}:</strong>{' '}
                            {formatDueDate(loan.startDate)}
                          </span>
                        )}
                        {loan.capitalDueDate && (
                          <span>
                            <strong className="text-gray-900">{t('Capital due')}:</strong>{' '}
                            {formatDueDate(loan.capitalDueDate)}
                          </span>
                        )}
                      </div>
                      {loan.note && <p className="text-xs text-gray-500 italic">{loan.note}</p>}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => startEdit(loan)}
                        className={btnCls}
                      >
                        {t('Edit')}
                      </button>
                      {isSettled ? (
                        <button
                          type="button"
                          onClick={() => handleReactivate(loan.id)}
                          className={btnCls}
                        >
                          {t('Reactivate')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSettle(loan.id)}
                          className="text-xs font-medium px-2.5 py-1 rounded-md border border-green-500 text-green-700 hover:bg-green-50 transition-colors"
                        >
                          {t('Capital Repaid')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(loan.id, loan.borrowerName)}
                        className="text-xs font-medium px-2.5 py-1 rounded-md border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        {t('Delete')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
