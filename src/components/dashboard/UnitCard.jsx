import { useState } from 'react'
import { getDaysRelative, formatDueDate, getTodayIso, describePayment, DAYS_PER_MONTH } from '../../data/tenants.js'
import { formatCurrency, milToAmount } from '../../data/currency.js'
import { t } from '../../data/i18n.js'
import EditableDate from './EditableDate.jsx'

/**
 * UnitCard — displays a single rental unit's status and tenant details (address, name, phone, rent).
 * Shows days overdue or days remaining based on payment status, or vacancy details
 * (vacant since, scheduled move-in, rent lost) when nobody lives in the unit.
 * The due date (this month only) and, once paid, the date paid are shown as plain text; clicking
 * one opens a date field for it (see EditableDate).
 * "Mark as Paid" opens a small panel: pay the full rent, or record a part payment (entered in COP mil),
 * which shows how many days of the month it covers (see DAYS_PER_MONTH) and the balance still owed.
 * A part payment can also carry a "balance expected by" date, shown (and editable) under the balance;
 * it turns red once passed but never changes the status.
 * A vacant tile shows an editable target move-in date until a move-in is scheduled; unit and tenant
 * notes and the services the tenant pays separately (edited in Manage Units) are shown at the bottom of the tile.
 *
 * A flagged tenant (pays late and/or in parts, see src/data/insights.js) also gets a small "Watch" tag next
 * to the status badge. It is information only: it never changes the tile's colour, status or position.
 *
 * @param {{
 *   unit: Object,
 *   insight?: Object,
 *   onTogglePaid: (id: string, paid: boolean) => void,
 *   onRecordPayment: (id: string, amount: number, balanceDueDate: string) => void,
 *   onPaidDateChange: (id: string, date: string) => void,
 *   onDueDateChange: (id: string, date: string) => void,
 *   onBalanceDueDateChange: (id: string, date: string) => void,
 *   onTargetMoveInChange: (id: string, date: string) => void
 * }} props
 */
export default function UnitCard({
  unit,
  insight,
  onTogglePaid,
  onRecordPayment,
  onPaidDateChange,
  onDueDateChange,
  onBalanceDueDateChange,
  onTargetMoveInChange,
}) {
  const [paying, setPaying] = useState(false)
  const [amountText, setAmountText] = useState('')
  const [balanceDueText, setBalanceDueText] = useState('')
  // Preview of the part payment being typed (days covered, balance); null until it is a valid amount
  const preview = paying ? describePayment(unit.rentAmount, unit.amountPaid, milToAmount(amountText)) : null
  const hasPartPayment = unit.status !== 'vacant' && unit.status !== 'paid' && unit.amountPaid > 0

  const statusStyles = {
    paid: 'border border-l-4 border-green-500 bg-green-50',
    'due-soon': 'border border-l-4 border-amber-400 bg-amber-50',
    upcoming: 'border border-l-4 border-gray-300 bg-gray-50',
    overdue: 'border border-l-4 border-red-500 bg-red-50',
    vacant: 'border border-dashed border-gray-300 bg-surface',
  }

  const badgeStyles = {
    paid: 'bg-green-100 text-green-800',
    'due-soon': 'bg-amber-100 text-amber-800',
    upcoming: 'bg-gray-200 text-gray-700',
    overdue: 'bg-red-100 text-red-800',
    vacant: 'bg-gray-100 text-gray-600',
  }

  const badgeLabels = {
    paid: t('Paid'),
    'due-soon': t('Due Soon'),
    upcoming: t('Upcoming'),
    overdue: t('Overdue'),
    vacant: t('Vacant'),
  }

  function getDaysLabel() {
    if (unit.status === 'paid') return null
    const days = getDaysRelative(unit.dueDate)
    if (days < 0) {
      const n = Math.abs(days)
      return { text: n === 1 ? t('1 day overdue') : t('{n} days overdue', { n }), cls: 'text-red-600' }
    }
    if (days === 0) {
      return { text: t('Due today'), cls: 'text-amber-600' }
    }
    return {
      text: days === 1 ? t('1 day remaining') : t('{n} days remaining', { n: days }),
      cls: unit.status === 'upcoming' ? 'text-gray-500' : 'text-amber-600',
    }
  }

  const daysLabel = unit.status === 'vacant' ? null : getDaysLabel()

  // Why the tenant is on watch, e.g. "Pays late: 3 of 5 months"
  const watchReasons =
    unit.status !== 'vacant' && insight
      ? [
          insight.paysLate && t('Pays late: {n} of {total} months', { n: insight.lateMonths, total: insight.judged }),
          insight.paysInParts && t('Pays in parts: {n} of {total} months', { n: insight.partMonths, total: insight.judged }),
        ].filter(Boolean)
      : []
  const watchText = watchReasons.length > 0 ? `${t('Watch')}: ${watchReasons.join('; ')}` : null

  const balanceDueLate = !!unit.balanceDueDate && getDaysRelative(unit.balanceDueDate) < 0
  const notes = [unit.unitNote, unit.tenantNote].filter(Boolean)
  const services = [
    [t('Water'), unit.serviceWater],
    [t('Gas'), unit.serviceGas],
    [t('Electricity'), unit.serviceElectricity],
  ].filter(([, text]) => text)

  function getVacancyLabel() {
    if (!unit.vacantSince) return t('No tenant')
    const n = Math.max(0, -getDaysRelative(unit.vacantSince))
    return `${t('Vacant since')} ${formatDueDate(unit.vacantSince)} · ${n === 1 ? t('1 day') : t('{n} days', { n })}`
  }

  return (
    <div className={`rounded-xl p-3 sm:p-4 flex flex-col gap-2 sm:gap-3 shadow-sm ${statusStyles[unit.status]}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-0.5">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
          {unit.address}
        </span>
        <span className="flex items-center gap-1">
          {watchText && (
            <span
              title={watchText}
              aria-label={watchText}
              className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800"
            >
              {t('Watch')}
            </span>
          )}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeStyles[unit.status]}`}>
            {badgeLabels[unit.status]}
          </span>
        </span>
      </div>

      {unit.status === 'vacant' ? (
        <div>
          <p className="font-semibold text-gray-600 text-sm">{getVacancyLabel()}</p>
          {unit.moveInDate && (
            <p className="text-xs font-medium mt-1 text-gray-700">
              {t('Move-in')} {formatDueDate(unit.moveInDate)}
              {unit.moveInDate <= getTodayIso() ? '' : ` ${t('(scheduled)')}`}
            </p>
          )}
          {!unit.moveInDate && (
            <div className="mt-1">
              <EditableDate
                label={t('Target move-in')}
                value={unit.targetMoveIn ?? ''}
                display={unit.targetMoveIn ? formatDueDate(unit.targetMoveIn) : t('not set')}
                onSave={(date) => onTargetMoveInChange(unit.id, date)}
                textClassName="text-xs text-gray-700"
                ariaLabel={`${t('Target move-in')}, ${unit.address}`}
              />
            </div>
          )}
          <p className="text-xs text-gray-500 mt-1 sm:mt-2">{t('Rent lost')}</p>
          <p className="text-lg sm:text-2xl font-bold tracking-tight text-gray-500">{formatCurrency(unit.rentAmount)}</p>
        </div>
      ) : (
        <div>
          <p className="font-semibold text-gray-900 text-sm sm:text-base leading-snug">{unit.tenantName}</p>
          {unit.phone && <p className="text-xs text-gray-500">{unit.phone}</p>}
          <p className="text-lg sm:text-2xl font-bold tracking-tight text-gray-900 mt-1">{formatCurrency(unit.rentAmount)}</p>
          {hasPartPayment && (
            <p className="text-xs font-medium text-gray-700 mt-0.5">
              {t('Received')} {formatCurrency(unit.amountPaid)} · {t('{days} of {total} days', { days: unit.daysCovered, total: DAYS_PER_MONTH })}
              <br />
              {t('Balance')} {formatCurrency(unit.balance)}
            </p>
          )}
          {hasPartPayment && (
            <div className="mt-0.5">
              <EditableDate
                label={t('Balance expected by')}
                value={unit.balanceDueDate ?? ''}
                display={unit.balanceDueDate ? formatDueDate(unit.balanceDueDate) : t('not set')}
                onSave={(date) => onBalanceDueDateChange(unit.id, date)}
                textClassName={`text-xs font-medium ${balanceDueLate ? 'text-red-600' : 'text-gray-700'}`}
                ariaLabel={`${t('Balance expected by')}, ${unit.tenantName}`}
              />
            </div>
          )}
          {unit.paymentLog.length > 0 && (
            <ul className="mt-0.5 text-xs text-gray-500" aria-label={`${t('Payments received')}, ${unit.tenantName}`}>
              {unit.paymentLog.map((p) => (
                <li key={p.id}>
                  {p.date ? formatDueDate(p.date) : t('Earlier')} · {formatCurrency(p.amount)}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-0.5">
            <EditableDate
              label={t('Due')}
              value={unit.dueDate}
              display={formatDueDate(unit.dueDate)}
              onSave={(date) => onDueDateChange(unit.id, date)}
              textClassName="text-xs text-gray-500"
              ariaLabel={`${t('Due date')}, ${unit.tenantName}`}
            />
          </div>
          {unit.status === 'paid' && unit.paidDate && (
            <div className="mt-1">
              <EditableDate
                label={t('Paid')}
                value={unit.paidDate}
                display={formatDueDate(unit.paidDate)}
                onSave={(date) => onPaidDateChange(unit.id, date)}
                textClassName="text-xs font-medium text-green-500"
                ariaLabel={`${t('Date paid')}, ${unit.tenantName}`}
              />
            </div>
          )}
          {daysLabel && (
            <p className={`text-xs font-medium mt-1 ${daysLabel.cls}`}>{daysLabel.text}</p>
          )}
        </div>
      )}

      {(notes.length > 0 || services.length > 0) && (
        <div className="text-xs text-gray-500 break-words">
          {notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
          {services.map(([label, text]) => (
            <p key={label}>
              {label}: {text}
            </p>
          ))}
        </div>
      )}

      {unit.status !== 'vacant' && !paying && (
        <button
          onClick={() => (unit.status === 'paid' ? onTogglePaid(unit.id, false) : setPaying(true))}
          className={`mt-auto text-xs font-medium px-3 py-1.5 rounded-md border transition-colors ${
            unit.status === 'paid'
              ? 'border-green-500 text-green-700 hover:bg-green-100'
              : 'border-gray-400 text-gray-700 hover:bg-surface'
          }`}
        >
          {unit.status === 'paid' ? t('Mark as Unpaid') : hasPartPayment ? t('Record payment') : t('Mark as Paid')}
        </button>
      )}

      {paying && (
        <div className="mt-auto flex flex-col gap-1.5 rounded-md border border-gray-300 bg-surface p-2.5">
          <button
            onClick={() => {
              setPaying(false)
              // With part payments in, the balance is logged as a dated payment so the list adds up to the rent
              if (unit.paymentLog.length > 0) onRecordPayment(unit.id, unit.balance)
              else onTogglePaid(unit.id, true)
            }}
            className="text-xs font-medium px-2 py-1 rounded-md border border-green-500 bg-green-500 text-white hover:bg-green-600"
          >
            {unit.balance < unit.rentAmount ? `${t('Pay balance')} ${formatCurrency(unit.balance)}` : t('Paid in full')}
          </button>
          <label className="text-xs text-gray-600">
            {t('Or part payment (COP mil)')}
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="5"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder={t('e.g. 250')}
              aria-label={`${t('Part payment in COP mil')}, ${unit.tenantName}`}
              className="mt-0.5 w-full min-w-0 px-1.5 py-1 rounded border border-gray-300 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>
          {preview && (
            <p className="text-xs text-gray-700">
              {preview.complete
                ? t('Covers the full rent')
                : `${t('{days} of {total} days', { days: preview.days, total: DAYS_PER_MONTH })} · ${t('balance')} ${formatCurrency(preview.balance)}`}
            </p>
          )}
          {preview && !preview.complete && (
            <label className="text-xs text-gray-600">
              {t('Balance expected by (optional)')}
              <input
                type="date"
                value={balanceDueText}
                onChange={(e) => setBalanceDueText(e.target.value)}
                aria-label={`${t('Balance expected by')}, ${unit.tenantName}`}
                className="mt-0.5 w-full min-w-0 px-1.5 py-1 rounded border border-gray-300 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </label>
          )}
          <div className="flex gap-1.5">
            <button
              disabled={!preview}
              onClick={() => {
                onRecordPayment(unit.id, milToAmount(amountText), balanceDueText)
                setPaying(false)
                setAmountText('')
                setBalanceDueText('')
              }}
              className="flex-1 text-xs font-medium px-2 py-1 rounded border border-gray-400 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('Save')}
            </button>
            <button
              onClick={() => {
                setPaying(false)
                setAmountText('')
                setBalanceDueText('')
              }}
              className="flex-1 text-xs font-medium px-2 py-1 rounded border border-gray-300 text-gray-500 hover:bg-gray-50"
            >
              {t('Cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
