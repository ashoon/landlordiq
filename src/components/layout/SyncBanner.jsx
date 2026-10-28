import { useSyncExternalStore } from 'react'
import { getStatus, subscribeStatus, resolveConflict, connect } from '../../data/driveSync.js'

/**
 * SyncBanner — full-width notice shown only when Google Drive sync needs attention:
 * a data conflict to resolve, an expired sign-in, being offline, or an error.
 * Renders nothing in all other states.
 */
export default function SyncBanner() {
  const status = useSyncExternalStore(subscribeStatus, getStatus)
  const { state, message } = status

  if (state === 'conflict') {
    return (
      <div role="alert" className="bg-red-50 border-b border-red-500 px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
        <p className="text-sm text-red-500 font-medium">{message}</p>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => resolveConflict('drive')}
            className="text-xs font-medium px-3 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-700"
          >
            Use Drive copy
          </button>
          <button
            onClick={() => resolveConflict('mine')}
            className="text-xs font-medium px-3 py-1.5 rounded border border-gray-400 text-gray-700 bg-white hover:bg-gray-50"
          >
            Keep this device&apos;s copy
          </button>
        </div>
        <p className="w-full text-xs text-gray-500">
          &quot;Use Drive copy&quot; first saves a backup of this device&apos;s data on this device.
          &quot;Keep this device&apos;s copy&quot; overwrites the Drive file.
        </p>
      </div>
    )
  }

  if (state === 'needs-auth') {
    return (
      <div role="alert" className="bg-red-50 border-b border-red-500 px-4 sm:px-6 py-2 flex items-center gap-3">
        <p className="text-sm text-red-500">{message} Your changes are safe on this device.</p>
        <button
          onClick={() => connect()}
          className="ml-auto text-xs font-medium px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Reconnect
        </button>
      </div>
    )
  }

  if (state === 'offline' || state === 'error') {
    const tone = state === 'error' ? 'bg-red-50 border-red-500 text-red-500' : 'bg-amber-50 border-amber-400 text-gray-700'
    return (
      <div role="status" className={`border-b px-4 sm:px-6 py-2 text-sm ${tone}`}>
        {message}
      </div>
    )
  }

  return null
}
