import { useState } from 'react'
import {
  getEditableUnits,
  getTodayIso,
  formatDueDate,
  validateUnit,
  updateUnit,
  addUnit,
  deleteUnit,
  validateMoveOut,
  moveOutUnit,
  validateMoveIn,
  moveInUnit,
  undoMoveOut,
  cancelMoveIn,
} from '../../data/tenants.js'
import { formatCurrency } from '../../data/currency.js'

const EMPTY_FORM = { address: '', tenantName: '', phone: '', rentAmount: '', dueDay: '' }

const inputCls =
  'w-full px-2 py-1 rounded border border-gray-300 text-sm text-gray-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-white'

const btnCls =
  'text-xs font-medium px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40'

/** Returns "1st", "2nd", "3rd", "4th"… for a day of the month. */
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

/**
 * ManageUnits — collapsible section for managing the apartment list: edit address,
 * tenant, phone, rent and monthly due day; add or delete units; and handle tenant
 * turnover with Move out (unit becomes vacant), Move in (new tenant, now or
 * scheduled for later), Undo move-out and Cancel move-in.
 * Changes are persisted by the data layer (store.js) and reported via onChange.
 *
 * @param {{ onChange: () => void }} props
 */
export default function ManageUnits({ onChange }) {
  const [open, setOpen] = useState(false)
  // Bumped after each mutation so the list re-reads from the data layer
  const [version, setVersion] = useState(0)
  // mode: 'edit' | 'moveOut' | 'moveIn' for the row with id `editingId`; editingId 'new' = add row
  const [editingId, setEditingId] = useState(null)
  const [mode, setMode] = useState('edit')
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  void version
  const units = getEditableUnits()

  function begin(id, nextMode, nextForm) {
    setEditingId(id)
    setMode(nextMode)
    setForm(nextForm)
    setError('')
  }

  const startAdd = () => begin('new', 'edit', EMPTY_FORM)

  const startEdit = (unit) =>
    begin(unit.id, 'edit', {
      address: unit.address,
      tenantName: unit.tenantName,
      phone: unit.phone,
      rentAmount: String(unit.rentAmount),
      dueDay: String(unit.dueDay),
    })

  const startMoveOut = (unit) => begin(unit.id, 'moveOut', { ...EMPTY_FORM, date: getTodayIso() })

  const startMoveIn = (unit) =>
    begin(unit.id, 'moveIn', {
      tenantName: '',
      phone: '',
      rentAmount: String(unit.rentAmount),
      dueDay: String(unit.dueDay),
      date: getTodayIso(),
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

  function save() {
    const err =
      mode === 'moveOut'
        ? validateMoveOut(editingId, form.date)
        : mode === 'moveIn'
          ? validateMoveIn(editingId, form)
          : validateUnit(form, editingId === 'new' ? undefined : editingId)
    if (err) {
      setError(err)
      return
    }

    if (mode === 'moveOut') moveOutUnit(editingId, form.date)
    else if (mode === 'moveIn') moveInUnit(editingId, form)
    else if (editingId === 'new') addUnit(form)
    else updateUnit(editingId, form)
    finish()
  }

  function remove(unit) {
    if (!window.confirm(`Delete ${unit.address} (${unit.tenantName}) and its tenant history?`)) return
    deleteUnit(unit.id)
    if (editingId === unit.id) setEditingId(null)
    commit()
  }

  function undo(unit) {
    undoMoveOut(unit.id)
    commit()
  }

  function cancelScheduled(unit) {
    cancelMoveIn(unit.id)
    commit()
  }

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const saveLabel = mode === 'moveOut' ? 'Move out' : mode === 'moveIn' ? 'Move in' : 'Save'

  /** Inline edit row. Cells vary by mode; the row always ends with Save / Cancel. */
  const editRow = (key, unit) => {
    const label = (text) => <span className="block text-[10px] uppercase text-gray-500 mb-0.5">{text}</span>

    return (
      <tr key={key} className="border-b border-gray-100 bg-blue-50">
        {mode === 'edit' && (
          <>
            <td className="px-3 py-2">
              <input className={inputCls} value={form.address} onChange={setField('address')} placeholder="Address" />
            </td>
            <td className="px-3 py-2">
              <input className={inputCls} value={form.tenantName} onChange={setField('tenantName')} placeholder="Tenant name" />
            </td>
            <td className="px-3 py-2 w-36">
              <input className={inputCls} value={form.phone} onChange={setField('phone')} placeholder="Phone" />
            </td>
            <td className="px-3 py-2 w-40">
              <input className={inputCls} type="number" min="0" step="5000" value={form.rentAmount} onChange={setField('rentAmount')} placeholder="Rent" />
            </td>
            <td className="px-3 py-2 w-28">
              <input className={inputCls} type="number" min="1" max="31" value={form.dueDay} onChange={setField('dueDay')} placeholder="Day" />
            </td>
          </>
        )}

        {mode === 'moveOut' && (
          <>
            <td className="px-3 py-2 font-medium text-gray-900">{unit.address}</td>
            <td className="px-3 py-2 text-gray-700" colSpan={3}>
              {unit.tenantName} moves out
            </td>
            <td className="px-3 py-2" colSpan={1}>
              {label('Move-out date')}
              <input className={inputCls} type="date" value={form.date} onChange={setField('date')} />
            </td>
          </>
        )}

        {mode === 'moveIn' && (
          <>
            <td className="px-3 py-2 font-medium text-gray-900">{unit.address}</td>
            <td className="px-3 py-2">
              {label('New tenant')}
              <input className={inputCls} value={form.tenantName} onChange={setField('tenantName')} placeholder="Tenant name" />
            </td>
            <td className="px-3 py-2 w-36">
              {label('Phone')}
              <input className={inputCls} value={form.phone} onChange={setField('phone')} />
            </td>
            <td className="px-3 py-2 w-40">
              {label('Rent')}
              <input className={inputCls} type="number" min="0" step="5000" value={form.rentAmount} onChange={setField('rentAmount')} />
            </td>
            <td className="px-3 py-2 w-40">
              {label('Due day')}
              <input className={inputCls} type="number" min="1" max="31" value={form.dueDay} onChange={setField('dueDay')} />
              <span className="block mt-1" />
              {label('Move-in date')}
              <input className={inputCls} type="date" value={form.date} onChange={setField('date')} />
            </td>
          </>
        )}

        <td className="px-3 py-2 w-44 text-right whitespace-nowrap">
          <button onClick={save} className="text-xs font-medium px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">
            {saveLabel}
          </button>
          <button onClick={cancel} className="ml-2 text-xs font-medium px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-white">
            Cancel
          </button>
        </td>
      </tr>
    )
  }

  /** Short note under a tenant name describing move-out / vacancy / scheduled move-in. */
  function renderNote(unit) {
    if (unit.vacant) {
      return (
        <p className="text-xs text-gray-500 mt-0.5">
          {unit.vacantSince ? `Vacant since ${formatDueDate(unit.vacantSince)}` : 'Vacant'}
          {unit.nextMoveIn && ` · ${unit.nextTenantName} moves in ${formatDueDate(unit.nextMoveIn)}`}
        </p>
      )
    }
    if (unit.moveOutDate) {
      return (
        <p className="text-xs text-amber-600 mt-0.5">Moving out {formatDueDate(unit.moveOutDate)}</p>
      )
    }
    if (unit.nextMoveIn) {
      return (
        <p className="text-xs text-gray-500 mt-0.5">
          {unit.nextTenantName} moves in {formatDueDate(unit.nextMoveIn)}
        </p>
      )
    }
    return null
  }

  return (
    <section className="mt-8 bg-white rounded-lg border border-gray-200">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-gray-700">
          Manage Units <span className="font-normal text-gray-500">({units.length})</span>
        </span>
        <span className="text-xs text-gray-500">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">
              Edit units, or use Move out / Move in when a tenant changes. Whoever lives in a unit on its due
              day owes that month&apos;s full rent; vacant months aren&apos;t expected.
            </p>
            <button
              onClick={startAdd}
              disabled={editingId !== null}
              className="text-xs font-medium px-3 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40"
            >
              + Add Unit
            </button>
          </div>

          {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                  <th className="px-3 py-2 font-medium">Address</th>
                  <th className="px-3 py-2 font-medium">Tenant</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 font-medium">Rent</th>
                  <th className="px-3 py-2 font-medium">Due day</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {editingId === 'new' && editRow('new')}
                {units.map((unit) =>
                  editingId === unit.id ? (
                    editRow(unit.id, unit)
                  ) : (
                    <tr key={unit.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-2 font-medium text-gray-900">{unit.address}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {unit.vacant ? <span className="text-gray-400">Vacant</span> : unit.tenantName}
                        {renderNote(unit)}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{unit.vacant ? '' : unit.phone}</td>
                      <td className="px-3 py-2 text-gray-700">{formatCurrency(unit.rentAmount)}</td>
                      <td className="px-3 py-2 text-gray-700">{ordinal(unit.dueDay)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {unit.canMoveOut && (
                          <button onClick={() => startMoveOut(unit)} disabled={editingId !== null} className={btnCls}>
                            Move out
                          </button>
                        )}
                        {unit.canMoveIn && (
                          <button onClick={() => startMoveIn(unit)} disabled={editingId !== null} className={btnCls}>
                            Move in
                          </button>
                        )}
                        {unit.canUndoMoveOut && (
                          <button onClick={() => undo(unit)} disabled={editingId !== null} className={btnCls}>
                            Undo move-out
                          </button>
                        )}
                        {unit.canCancelMoveIn && (
                          <button onClick={() => cancelScheduled(unit)} disabled={editingId !== null} className={btnCls}>
                            Cancel move-in
                          </button>
                        )}
                        {!unit.vacant && (
                          <button onClick={() => startEdit(unit)} disabled={editingId !== null} className={`ml-2 ${btnCls}`}>
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => remove(unit)}
                          className="ml-2 text-xs font-medium px-3 py-1 rounded border border-red-500 text-red-500 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
