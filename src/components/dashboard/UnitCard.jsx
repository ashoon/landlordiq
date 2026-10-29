import { useState } from 'react'
import { getDaysRelative, formatDueDate, getTodayIso, describePayment, DAYS_PER_MONTH } from '../../data/tenants.js'
import { formatCurrency, milToAmount } from '../../data/currency.js'
import EditableDate from './EditableDate.jsx'

/**
 * UnitCard — displays a single rental unit's status and tenant details (address, name, phone, rent).
 * Shows days overdue or days remaining based on payment status, or vacancy details
 * (vacant since, scheduled move-in, rent lost) when nobody lives in the unit.
 * The due date (this month only) and, once paid, the date paid are shown as plain text; clicking
 * one opens a date field for it (see EditableDate).
 * "Mark as Paid" opens a small panel: pay the full rent, or record a part payment (entered in COP mil),
 * which shows how many days of the month it covers (see DAYS_PER_MONTH) and the balance still owed.
 *
 * @param {{
 *   unit: Object,
 *   onTogglePaid: (id: string, paid: boolean) => void,
 *   onRecordPayment: (id: string, amount: number) => void,
 *   onPaidDateChange: (id: string, date: string) => void,
 *   onDueDateChange: (id: string, date: string) => void
 * }} props
 */
export default function UnitCard({ unit, onTogglePaid, onRecordPayment, onPaidDateChange, onDueDateChange }) {
  const [paying, setPaying] = useState(false)
  const [amountText, setAmountText] = useState('')
  // Preview of the part payment being typed (days covered, balance); null until it is a valid amount
  const preview = paying ? describePayment(unit.rentAmount, unit.amountPaid, milToAmount(amountText)) : null
  const hasPartPayment = unit.status !== 'vacant' && unit.status !== 'paid' && unit.amountPaid > 0

  const statusStyles = {
    paid: 'border-green-500 bg-green-50',
    'due-soon': 'border-amber-400 bg-amber-50',
    upcoming: 'border-gray-300 bg-gray-50',
    overdue: 'border-red-500 bg-red-50',
    vacant: 'border-dashed border-gray-300 bg-white',
  }

  const badgeStyles = {
    paid: 'bg-green-100 text-green-800',
    'due-soon': 'bg-amber-100 text-amber-800',
    upcoming: 'bg-gray-200 text-gray-700',
    overdue: 'bg-red-100 text-red-800',
    vacant: 'bg-gray-100 text-gray-600',
  }

  const badgeLabels = {
    paid: 'Paid',
    'due-soon': 'Due Soon',
    upcoming: 'Upcoming',
    overdue: 'Overdue',
    vacant: 'Vacant',
  }

  function getDaysLabel() {
    if (unit.status === 'paid') return null
    const days = getDaysRelative(unit.dueDate)
    if (days < 0) {
      const n = Math.abs(days)
      return { text: `${n} day${n !== 1 ? 's' : ''} overdue`, cls: 'text-red-600' }
    }
    if (days === 0) {
      return { text: 'Due today', cls: 'text-amber-600' }
    }
    return {
      text: `${days} day${days !== 1 ? 's' : ''} remaining`,
      cls: unit.status === 'upcoming' ? 'text-gray-500' : 'text-amber-600',
    }
  }

  const daysLabel = unit.status === 'vacant' ? null : getDaysLabel()

  function getVacancyLabel() {
    if (!unit.vacantSince) return 'No tenant'
    const n = Math.max(0, -getDaysRelative(unit.vacantSince))
    return `Vacant since ${formatDueDate(unit.vacantSince)} · ${n} day${n !== 1 ? 's' : ''}`
  }

  return (
    <div className={`rounded-lg border-2 p-2.5 sm:p-4 flex flex-col gap-1.5 sm:gap-3 ${statusStyles[unit.status]}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-0.5">
        <span className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {unit.address}
        </span>
        <span className={`text-[11px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded-full ${badgeStyles[unit.status]}`}>
          {badgeLabels[unit.status]}
        </span>
      </div>

      {unit.status === 'vacant' ? (
        <div>
          <p className="font-semibold text-gray-500 text-xs sm:text-sm">{getVacancyLabel()}</p>
          {unit.moveInDate && (
            <p className="text-xs font-medium mt-0.5 sm:mt-1 text-gray-700">
              Move-in {formatDueDate(unit.moveInDate)}
              {unit.moveInDate <= getTodayIso() ? '' : ' (scheduled)'}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1 sm:mt-2">Rent lost</p>
          <p className="text-base sm:text-xl font-bold text-gray-500">{formatCurrency(unit.rentAmount)}</p>
        </div>
      ) : (
        <div>
          <p className="font-semibold text-gray-900 text-xs sm:text-sm">{unit.tenantName}</p>
          {unit.phone && <p className="text-[11px] sm:text-xs text-gray-500">{unit.phone}</p>}
          <p className="text-base sm:text-xl font-bold text-gray-900 mt-0.5 sm:mt-1">{formatCurrency(unit.rentAmount)}</p>
          {hasPartPayment && (
            <p className="text-xs font-medium text-gray-700 mt-0.5">
              Received {formatCurrency(unit.amountPaid)} · {unit.daysCovered} of {DAYS_PER_MONTH} days
              <br />
              Balance {formatCurrency(unit.balance)}
            </p>
          )}
          <div className="mt-0.5">
            <EditableDate
              label="Due"
              value={unit.dueDate}
              display={formatDueDate(unit.dueDate)}
              onSave={(date) => onDueDateChange(unit.id, date)}
              textClassName="text-xs text-gray-500"
              ariaLabel={`Due date, ${unit.tenantName}`}
            />
          </div>
          {unit.status === 'paid' && unit.paidDate && (
            <div className="mt-0.5 sm:mt-1">
              <EditableDate
                label="Paid"
                value={unit.paidDate}
                display={formatDueDate(unit.paidDate)}
                onSave={(date) => onPaidDateChange(unit.id, date)}
                textClassName="text-xs font-medium text-green-500"
                ariaLabel={`Date paid, ${unit.tenantName}`}
              />
            </div>
          )}
          {daysLabel && (
            <p className={`text-xs font-medium mt-0.5 sm:mt-1 ${daysLabel.cls}`}>{daysLabel.text}</p>
          )}
        </div>
      )}

      {unit.status !== 'vacant' && !paying && (
        <button
          onClick={() => (unit.status === 'paid' ? onTogglePaid(unit.id, false) : setPaying(true))}
          className={`mt-auto text-[11px] sm:text-xs font-medium px-2 sm:px-3 py-1 sm:py-1.5 rounded border transition-colors ${
            unit.status === 'paid'
              ? 'border-green-600 text-green-700 hover:bg-green-100'
              : 'border-gray-400 text-gray-600 hover:bg-white'
          }`}
        >
          {unit.status === 'paid' ? 'Mark as Unpaid' : hasPartPayment ? 'Record payment' : 'Mark as Paid'}
        </button>
      )}

      {paying && (
        <div className="mt-auto flex flex-col gap-1.5 rounded border border-gray-300 bg-white p-2">
          <button
            onClick={() => {
              setPaying(false)
              onTogglePaid(unit.id, true)
            }}
            className="text-[11px] sm:text-xs font-medium px-2 py-1 rounded border border-green-600 bg-green-600 text-white hover:bg-green-700"
          >
            {unit.balance < unit.rentAmount ? `Pay balance ${formatCurrency(unit.balance)}` : 'Paid in full'}
          </button>
          <label className="text-[11px] sm:text-xs text-gray-600">
            Or part payment (COP mil)
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="5"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="e.g. 250"
              aria-label={`Part payment in COP mil, ${unit.tenantName}`}
              className="mt-0.5 w-full min-w-0 px-1.5 py-1 rounded border border-gray-300 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </label>
          {preview && (
            <p className="text-[11px] sm:text-xs text-gray-700">
              {preview.complete
                ? 'Covers the full rent'
                : `${preview.days} of ${DAYS_PER_MONTH} days · balance ${formatCurrency(preview.balance)}`}
            </p>
          )}
          <div className="flex gap-1.5">
            <button
              disabled={!preview}
              onClick={() => {
                onRecordPayment(unit.id, milToAmount(amountText))
                setPaying(false)
                setAmountText('')
              }}
              className="flex-1 text-[11px] sm:text-xs font-medium px-2 py-1 rounded border border-gray-400 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save
            </button>
            <button
              onClick={() => {
                setPaying(false)
                setAmountText('')
              }}
              className="flex-1 text-[11px] sm:text-xs font-medium px-2 py-1 rounded border border-gray-300 text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
