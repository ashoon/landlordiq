import { useState, useSyncExternalStore } from 'react'
import {
  getStatus,
  subscribeStatus,
  describeStatus,
  isDriveConfigured,
  isPickerConfigured,
  openSharedFile,
  connect,
  disconnect,
  flush,
} from '../../data/driveSync.js'
import { t, getLocale } from '../../data/i18n.js'
import { btnCls } from '../common/ui.js'

const STATES = {
  disconnected: { label: 'Google Drive: not connected', dot: 'bg-gray-400', text: 'text-gray-600' },
  connecting: { label: 'Connecting to Drive…', dot: 'bg-amber-400', text: 'text-gray-600' },
  synced: { label: 'Saved to Drive', dot: 'bg-green-500', text: 'text-gray-600' },
  saving: { label: 'Saving…', dot: 'bg-amber-400', text: 'text-gray-600' },
  unsynced: { label: 'Unsaved changes', dot: 'bg-amber-400', text: 'text-gray-600' },
  offline: { label: 'Offline — saved on this device', dot: 'bg-amber-400', text: 'text-gray-600' },
  'needs-auth': { label: 'Sign-in expired', dot: 'bg-red-500', text: 'text-red-500' },
  conflict: { label: 'Needs your decision', dot: 'bg-red-500', text: 'text-red-500' },
  error: { label: 'Drive error', dot: 'bg-red-500', text: 'text-red-500' },
}


/**
 * DriveStatus — header control showing the Google Drive sync state, with Connect /
 * Reconnect / Save now / Disconnect actions. Renders nothing when no Google client ID
 * is configured (local-only mode).
 */
export default function DriveStatus() {
  const status = useSyncExternalStore(subscribeStatus, getStatus)
  const [menuOpen, setMenuOpen] = useState(false)

  if (!isDriveConfigured()) return null

  const state = STATES[status.state]
  const connected = status.state !== 'disconnected'

  if (!connected || status.state === 'needs-auth') {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => connect()}
          className="text-xs font-medium px-3 py-2 rounded bg-brand-600 text-white hover:bg-brand-700"
        >
          {status.state === 'needs-auth' ? t('Reconnect Google Drive') : t('Connect Google Drive')}
        </button>
        {status.state === 'disconnected' && isPickerConfigured() && (
          <button
            onClick={() => openSharedFile()}
            title={t('Open a landlordiq-data.json file that someone shared with your Google account')}
            className="text-xs font-medium px-3 py-2 rounded border border-gray-300 bg-surface text-gray-600 hover:bg-gray-50"
          >
            {t('Open shared file')}
          </button>
        )}
      </div>
    )
  }

  const lastSynced = status.lastSynced
    ? new Date(status.lastSynced).toLocaleTimeString(getLocale(), { hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((o) => !o)}
        aria-expanded={menuOpen}
        title={describeStatus(status) || undefined}
        className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded border border-gray-300 bg-surface hover:bg-gray-50 ${state.text}`}
      >
        <span className={`inline-block h-2 w-2 rounded-full ${state.dot}`} />
        {t(state.label)}
      </button>
      {menuOpen && (
        <div className="absolute right-0 z-10 mt-1 w-56 rounded border border-gray-200 bg-surface p-3 shadow-md space-y-2">
          {lastSynced && <p className="text-xs text-gray-500">{t('Last saved to Drive at')} {lastSynced}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => {
                flush()
                setMenuOpen(false)
              }}
              className={btnCls}
            >
              {t('Save now')}
            </button>
            <button
              onClick={() => {
                disconnect()
                setMenuOpen(false)
              }}
              className={`${btnCls} text-red-500 border-red-500 hover:bg-red-50`}
            >
              {t('Disconnect')}
            </button>
          </div>
          {isPickerConfigured() && (
            <button
              onClick={() => {
                openSharedFile()
                setMenuOpen(false)
              }}
              className={`${btnCls} w-full`}
            >
              {t('Open a shared file…')}
            </button>
          )}
          <p className="text-xs text-gray-400">{t('Disconnecting keeps your data on this device and on Drive.')}</p>
        </div>
      )}
    </div>
  )
}
