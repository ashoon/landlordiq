import { useState, useRef, useEffect } from 'react'
import { validateDate } from '../../data/tenants.js'

/**
 * EditableDate — a date shown as plain text that turns into a date field only when clicked.
 * The calendar opens right away. The change is saved when the field loses focus or Enter is
 * pressed, and only if it is a complete valid date; Escape cancels. Otherwise it stays plain text.
 *
 * @param {{
 *   label: string,
 *   value: string,
 *   display: string,
 *   onSave: (date: string) => void,
 *   textClassName: string,
 *   ariaLabel: string
 * }} props - `value` is "YYYY-MM-DD", `display` is the formatted text, `textClassName` the text colour/size classes
 */
export default function EditableDate({ label, value, display, onSave, textClassName, ariaLabel }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    try {
      inputRef.current?.showPicker()
    } catch {
      // Browsers without showPicker (or without a recent click) just show the typed field
    }
  }, [editing])

  function start() {
    setDraft(value)
    setEditing(true)
  }

  function finish(save) {
    setEditing(false)
    if (save && !validateDate(draft) && draft !== value) onSave(draft)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={start}
        aria-label={`${ariaLabel}: ${display}. Click to change.`}
        className={`block text-left ${textClassName} hover:underline decoration-dotted underline-offset-2 cursor-pointer`}
      >
        {label} {display}
      </button>
    )
  }

  return (
    <label className={`flex items-center gap-2 ${textClassName}`}>
      {label}
      <input
        ref={inputRef}
        type="date"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') finish(true)
          if (e.key === 'Escape') finish(false)
        }}
        aria-label={ariaLabel}
        className="px-1.5 py-0.5 rounded border border-gray-300 bg-white text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
    </label>
  )
}
