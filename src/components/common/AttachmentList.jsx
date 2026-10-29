import { useState, useSyncExternalStore } from 'react'
import {
  ACCEPTED_TYPES,
  uploadFile,
  openAttachment,
  isUploadAvailable,
  describeAttachmentError,
  getStatus,
  subscribeStatus,
} from '../../data/attachments.js'
import { formatDueDate } from '../../data/tenants.js'
import { t } from '../../data/i18n.js'

/**
 * AttachmentList — the files attached to a record (contract scans or receipts) with an "Attach" control.
 * Files are uploaded to the user's Google Drive and only a small reference is kept in the record, so
 * attaching needs Drive to be connected and online (the button is disabled otherwise). Clicking a file
 * name opens it in a new tab.
 *
 * @param {{
 *   files: Array<{ id: string, name: string, uploadedAt: string }> | undefined,
 *   kind: 'contracts' | 'receipts',
 *   label: string,
 *   onAdd: (ref: { id: string, name: string, mimeType: string, uploadedAt: string }) => void,
 *   onRemove: (fileId: string) => void,
 * }} props
 */
export default function AttachmentList({ files, kind, label, onAdd, onRemove }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useSyncExternalStore(subscribeStatus, getStatus)
  const available = isUploadAvailable()

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    try {
      onAdd(await uploadFile(file, kind))
    } catch (err) {
      setError(describeAttachmentError(err))
    } finally {
      setBusy(false)
    }
  }

  async function open(id) {
    setError('')
    try {
      await openAttachment(id)
    } catch (err) {
      setError(describeAttachmentError(err))
    }
  }

  return (
    <div className="text-xs">
      {(files ?? []).length > 0 && (
        <ul className="space-y-0.5">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => open(f.id)}
                disabled={!available}
                title={f.uploadedAt ? formatDueDate(f.uploadedAt.slice(0, 10)) : ''}
                className="min-w-0 truncate text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
              >
                {f.name}
              </button>
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                aria-label={`${t('Remove')} ${f.name}`}
                className="text-red-500 hover:underline"
              >
                {t('Remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
      <label
        className={`inline-block mt-1 px-2 py-1 rounded border border-gray-300 ${
          available && !busy ? 'cursor-pointer text-gray-700 hover:bg-gray-50' : 'cursor-not-allowed text-gray-400'
        }`}
      >
        {busy ? t('Uploading…') : label}
        <input type="file" accept={ACCEPTED_TYPES} className="hidden" disabled={!available || busy} onChange={pick} />
      </label>
      {!available && <p className="mt-1 text-gray-400">{t('Connect Google Drive to attach or open files.')}</p>}
      {error && <p className="mt-1 text-red-500">{error}</p>}
    </div>
  )
}
