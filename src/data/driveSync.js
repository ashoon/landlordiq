/**
 * driveSync.js — keeps the app's data in a single JSON file on the user's Google Drive.
 *
 * The app always works from the local store (store.js). When Drive is connected this module
 * mirrors the store to `landlordiq-data.json` and pulls in changes made on other devices:
 *
 *   - Sign-in uses Google Identity Services with the `drive.file` scope, so the app can only
 *     see files it created itself, never the rest of the user's Drive.
 *   - Local edits are uploaded after a short debounce. Before every upload the file's content
 *     checksum is compared with the one last synced; if Drive moved on, the two copies are
 *     merged record by record (merge.js) against the last synced data, and the result is
 *     uploaded. Only when there is no last synced copy to merge against is the user asked
 *     which copy to keep (status 'conflict').
 *   - While the tab is visible, Drive is polled every POLL_INTERVAL_MS; it is also checked when
 *     the tab regains focus or the network returns. Data is only replaced if Drive changed.
 *   - If Drive is unreachable, edits stay on this device and sync when it is back.
 *
 * Without a client ID (VITE_GOOGLE_CLIENT_ID) sync is disabled and the app is local-only.
 */
import {
  exportAll,
  importAll,
  isEmpty,
  fillData,
  subscribe,
  getMeta,
  setMeta,
  getBase,
  setBase,
  saveLocalBackup,
} from './store.js'
import { mergeData, stable } from './merge.js'

const CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID ?? ''
/** Browser API key (Google Picker API enabled). Optional: without it, "Open a shared file" is hidden. */
const API_KEY = import.meta.env?.VITE_GOOGLE_API_KEY ?? ''
/** The Cloud project number is the part of the client ID before the first dash; the Picker needs it. */
const APP_ID = CLIENT_ID.split('-')[0]
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const FILE_NAME = 'landlordiq-data.json'
/** Folder path in My Drive that holds the data file (created on demand). */
const FOLDER_PATH = ['Colombia', 'Apartments']
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const SAVE_DELAY_MS = 1500
/** How often an open, visible tab checks Drive for changes made by someone else. */
const POLL_INTERVAL_MS = 30_000
const SILENT_AUTH_TIMEOUT_MS = 8000
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

/** States in which edits are kept locally and not uploaded until the user acts. */
const HOLD_STATES = new Set(['disabled', 'disconnected', 'connecting', 'needs-auth', 'conflict'])

const SHARED_GONE_MESSAGE =
  "The shared data file can't be opened any more (deleted, or no longer shared with you). Use Disconnect, then connect again."

const CONFLICT_MESSAGE =
  'The data on Google Drive differs from the data on this device. Choose which copy to keep.'

class AuthError extends Error {}

/** A fetch() that failed before any response arrived (offline, DNS, blocked by the browser). */
class NetworkError extends Error {}

/** A Google script (sign-in or file picker) that couldn't be loaded, often blocked by a content blocker. */
class ScriptLoadError extends Error {}

class DriveError extends Error {
  constructor(status, detail) {
    super(`Google Drive error ${status}${detail ? `: ${detail}` : ''}`)
    this.status = status
  }
}

// ---------------------------------------------------------------- status

let status = {
  state: !CLIENT_ID ? 'disabled' : getMeta().connected ? 'connecting' : 'disconnected',
  message: '',
  lastSynced: getMeta().lastSynced,
}
const statusListeners = new Set()

function setStatus(state, message = '') {
  status = { state, message, lastSynced: getMeta().lastSynced }
  statusListeners.forEach((listener) => listener())
}

/**
 * Current sync status. The same object is returned until the status changes.
 *
 * @returns {{ state: 'disabled'|'disconnected'|'connecting'|'synced'|'saving'|'unsynced'|'needs-auth'|'offline'|'conflict'|'error', message: string, lastSynced: string|null }}
 */
export function getStatus() {
  return status
}

/**
 * Subscribes to status changes (compatible with React's useSyncExternalStore).
 *
 * @param {() => void} listener
 * @returns {() => void} unsubscribe
 */
export function subscribeStatus(listener) {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

/**
 * Whether a Google client ID was provided at build time.
 *
 * @returns {boolean}
 */
export function isDriveConfigured() {
  return CLIENT_ID !== ''
}

/**
 * Whether "Open a shared file" is available (needs a client ID and a Google API key).
 *
 * @returns {boolean}
 */
export function isPickerConfigured() {
  return CLIENT_ID !== '' && API_KEY !== ''
}

// ---------------------------------------------------------------- queue & state

let chain = Promise.resolve()
let token = null // { value, expiresAt }
let pendingConflict = null // { file, remote }
let changeCounter = 0
let saveTimer = null
let initialized = false
let gisPromise = null
let pickerPromise = null

/** Runs tasks one at a time so syncs never overlap. */
function enqueue(task) {
  const run = chain.then(task)
  chain = run.catch(() => {})
  return run
}

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function handleError(error) {
  console.error('[LandlordIQ] Drive sync error:', error)
  if (error instanceof ScriptLoadError) {
    setStatus('error', `${error.message} A content blocker or privacy setting may be blocking Google; try disabling it for this site.`)
  } else if (error instanceof AuthError || (error instanceof DriveError && error.status === 401)) {
    token = null
    setStatus('needs-auth', 'Sign in again to keep syncing with Google Drive.')
  } else if (error instanceof DriveError && error.status === 403) {
    setStatus('error', `${error.message}. Check the Google Cloud setup (Drive API enabled, test user added).`)
  } else if (error instanceof NetworkError || isOffline()) {
    setStatus('offline', "Can't reach Google Drive. Changes are saved on this device and will sync when you're back online.")
  } else {
    setStatus('error', error?.message || 'Something went wrong while syncing with Google Drive.')
  }
}

// ---------------------------------------------------------------- Google sign-in

function gisReady() {
  return Boolean(globalThis.window?.google?.accounts?.oauth2)
}

function loadGis() {
  if (gisReady()) return Promise.resolve()
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        gisPromise = null
        reject(new ScriptLoadError("Couldn't load Google sign-in."))
      }
      document.head.appendChild(script)
    })
  }
  return gisPromise
}

/** Loads Google's Picker library (gapi + its "picker" module). */
function loadPicker() {
  if (globalThis.window?.google?.picker) return Promise.resolve()
  pickerPromise ??= new Promise((resolve, reject) => {
    const fail = () => {
      pickerPromise = null
      reject(new ScriptLoadError("Couldn't load the Google file picker."))
    }
    const script = document.createElement('script')
    script.src = 'https://apis.google.com/js/api.js'
    script.async = true
    script.onload = () => globalThis.window.gapi.load('picker', { callback: resolve, onerror: fail })
    script.onerror = fail
    document.head.appendChild(script)
  })
  return pickerPromise
}

/** Shows Google's file picker; resolves with the chosen file's id, or null if it was cancelled. */
async function pickFile() {
  await loadPicker()
  const { picker } = globalThis.window.google
  const view = (sharedWithMe) => {
    const docs = new picker.DocsView(picker.ViewId.DOCS).setMimeTypes('application/json')
    return sharedWithMe ? docs.setOwnedByMe(false) : docs
  }
  return new Promise((resolve) => {
    new picker.PickerBuilder()
      .setAppId(APP_ID)
      .setDeveloperKey(API_KEY)
      .setOAuthToken(token.value)
      .setTitle(`Choose ${FILE_NAME}`)
      .addView(view(true))
      .addView(view(false))
      .setCallback((data) => {
        const action = data[picker.Response.ACTION]
        if (action === picker.Action.PICKED) resolve(data[picker.Response.DOCUMENTS][0][picker.Document.ID])
        else if (action === picker.Action.CANCEL) resolve(null)
      })
      .build()
      .setVisible(true)
  })
}

/**
 * Requests an access token. `prompt` '' may open Google's popup (call it straight from a click
 * so browsers allow it); 'none' never shows UI and fails if the user must interact.
 */
function requestToken(prompt) {
  const start = () =>
    new Promise((resolve, reject) => {
      let timer = null
      if (prompt === 'none') {
        timer = setTimeout(() => reject(new AuthError('timeout')), SILENT_AUTH_TIMEOUT_MS)
      }
      const done = (fn) => (value) => {
        clearTimeout(timer)
        fn(value)
      }
      const client = globalThis.window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: done((response) => {
          if (response.error) return reject(new AuthError(response.error))
          token = {
            value: response.access_token,
            expiresAt: Date.now() + Number(response.expires_in || 3600) * 1000,
          }
          resolve()
        }),
        error_callback: done((error) => reject(new AuthError(error?.type || 'popup_closed'))),
      })
      client.requestAccessToken({ prompt })
    })
  return gisReady() ? start() : loadGis().then(start)
}

async function ensureToken() {
  if (token && Date.now() < token.expiresAt - 60_000) return
  await requestToken('none')
}

// ---------------------------------------------------------------- Drive API

async function api(url, options = {}) {
  let response
  try {
    response = await fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token.value}`, ...options.headers },
    })
  } catch (error) {
    throw new NetworkError(error?.message || 'Network request failed')
  }
  if (!response.ok) {
    let detail = ''
    try {
      detail = (await response.json())?.error?.message ?? ''
    } catch {
      // Body wasn't JSON
    }
    throw new DriveError(response.status, detail)
  }
  return response
}

/**
 * Finds the folder with this name under `parentId` or creates it.
 * (With the drive.file scope only folders created by this app are visible, so the app owns the path.)
 */
async function ensureFolder(name, parentId) {
  const query = encodeURIComponent(
    `name = '${name}' and mimeType = '${FOLDER_MIME}' and '${parentId}' in parents and trashed = false`,
  )
  const url = `${API}/files?q=${query}&spaces=drive&orderBy=createdTime&pageSize=1&fields=files(id)`
  const { files } = await (await api(url)).json()
  if (files?.[0]) return files[0].id
  const response = await api(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  })
  return (await response.json()).id
}

let folderIdPromise = null

/** Returns the id of the last folder in FOLDER_PATH, creating missing folders. Cached per session. */
function ensureFolderPath() {
  folderIdPromise ??= FOLDER_PATH.reduce(
    (parent, name) => parent.then((parentId) => ensureFolder(name, parentId)),
    Promise.resolve('root'),
  ).catch((error) => {
    folderIdPromise = null
    throw error
  })
  return folderIdPromise
}

/**
 * Moves a data file that sits elsewhere (e.g. My Drive root) into the folder. Best effort.
 * Returns the file's current { id, version, parents }: a move can bump the Drive version.
 */
async function moveIntoFolder(file) {
  try {
    const folderId = await ensureFolderPath()
    const parents = file.parents ?? []
    if (parents.includes(folderId)) return file
    const remove = parents.length ? `&removeParents=${parents.join(',')}` : ''
    const response = await api(
      `${API}/files/${file.id}?addParents=${folderId}${remove}&fields=id,version,md5Checksum,parents`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    )
    return await response.json()
  } catch (error) {
    if (error instanceof AuthError) throw error
    return file // Leaving the file where it is does not affect syncing
  }
}

/**
 * Identifies the file's content for conflict detection. Drive's `version` also changes for
 * server-side reasons that aren't edits (indexing, moves), so the content checksum is preferred.
 */
function fileToken(file) {
  return String(file.md5Checksum ?? file.version)
}

/** Finds the data file this app created (most recently modified if several). */
async function findFile() {
  const query = encodeURIComponent(`name = '${FILE_NAME}' and trashed = false`)
  const url = `${API}/files?q=${query}&spaces=drive&orderBy=modifiedTime%20desc&pageSize=1&fields=files(id,version,md5Checksum,parents)`
  const { files } = await (await api(url)).json()
  return files?.[0] ?? null
}

/** Returns { id, version, parents } or null when the file is gone or trashed. */
async function getFileMeta(id) {
  try {
    const file = await (await api(`${API}/files/${id}?fields=id,version,md5Checksum,trashed,parents`)).json()
    return file.trashed ? null : file
  } catch (error) {
    if (error instanceof DriveError && error.status === 404) return null
    throw error
  }
}

async function downloadFile(id) {
  const text = await (await api(`${API}/files/${id}?alt=media`)).text()
  if (!text.trim()) return fillData({})
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`The ${FILE_NAME} file on Google Drive isn't valid JSON, so it wasn't loaded.`)
  }
  return fillData(parsed?.data ?? parsed)
}

function wrap(data) {
  return JSON.stringify({ app: 'landlordiq', schema: 1, savedAt: new Date().toISOString(), data })
}

async function createFile(data) {
  const parentId = await ensureFolderPath()
  const boundary = `landlordiq${Math.random().toString(36).slice(2)}`
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify({ name: FILE_NAME, mimeType: 'application/json', parents: [parentId] })}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${wrap(data)}\r\n--${boundary}--`
  const response = await api(`${UPLOAD}/files?uploadType=multipart&fields=id,version,md5Checksum`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  return response.json()
}

async function updateFile(id, data) {
  const body = wrap(data)
  const response = await api(`${UPLOAD}/files/${id}?uploadType=media&fields=id,version,md5Checksum`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    // keepalive lets a save started as the tab closes still finish (limited to ~64 KB)
    keepalive: body.length < 60_000,
    body,
  })
  return response.json()
}

// ---------------------------------------------------------------- sync logic

/**
 * Records that this device and Drive now agree on `data` (the common ancestor for later merges).
 * `stamp` is the change counter when `data` was captured; later edits leave the store dirty.
 */
function markSynced(file, stamp, data) {
  const stillDirty = changeCounter !== stamp
  setBase(data)
  setMeta({
    connected: true,
    fileId: file.id,
    version: fileToken(file),
    dirty: stillDirty,
    lastSynced: new Date().toISOString(),
  })
  pendingConflict = null
  setStatus(stillDirty ? 'unsynced' : 'synced')
  if (stillDirty) schedulePush()
}

/** Replaces the local data with the Drive copy (keeping a safety backup of local data first). */
function adoptRemote(file, remote) {
  if (!isEmpty()) saveLocalBackup()
  importAll(remote)
  markSynced(file, changeCounter, remote)
}

async function raiseConflict(file) {
  pendingConflict = { file, remote: await downloadFile(file.id) }
  setStatus('conflict', CONFLICT_MESSAGE)
}

/** When Drive still has the copy we last synced but no base was stored (older installs), stores it. */
async function ensureBase(file) {
  if (!getBase()) setBase(await downloadFile(file.id))
}

/**
 * Both this device and Drive changed: merges Drive's copy into the local data and uploads the
 * result. Falls back to asking the user when there is no last synced copy to merge against.
 */
async function mergeWithRemote(file) {
  const base = getBase()
  if (!base || getMeta().fileId !== file.id) return raiseConflict(file)

  let current = file
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const remote = await downloadFile(current.id)
    const local = exportAll()
    const merged = mergeData(base, local, remote)
    const latest = await getFileMeta(current.id)
    // Drive changed again while merging: start over from the newest copy
    if (latest && fileToken(latest) !== fileToken(current)) {
      current = latest
      continue
    }
    if (stable(merged) !== stable(local)) {
      saveLocalBackup()
      importAll(merged)
    }
    const stamp = changeCounter
    if (!latest) return markSynced(await createFile(merged), stamp, merged)
    if (stable(merged) === stable(remote)) return markSynced(current, stamp, merged)
    return markSynced({ id: current.id, ...(await updateFile(current.id, merged)) }, stamp, merged)
  }
  return raiseConflict(current)
}

/** Compares this device with Drive right after connecting, and decides what to do. */
async function reconcile() {
  folderIdPromise = null // re-resolve the folder in case it was deleted or changed since last time
  const meta = getMeta()
  let file = meta.fileId ? await getFileMeta(meta.fileId) : null
  if (!file && meta.shared) throw new Error(SHARED_GONE_MESSAGE)
  if (!file) file = await findFile()

  if (!file) {
    const snapshot = exportAll()
    markSynced(await createFile(snapshot), changeCounter, snapshot)
    return
  }
  // Moving the file bumps its Drive version, so judge "unchanged" by the version seen before the move.
  // A file shared by someone else stays where its owner put it.
  const versionBeforeMove = fileToken(file)
  if (!meta.shared) file = await moveIntoFolder(file)

  const remote = await downloadFile(file.id)
  const local = exportAll()
  const sameFile = meta.fileId === file.id
  const remoteUnchanged = sameFile && meta.version === versionBeforeMove

  if (stable(remote) === stable(fillData(local))) markSynced(file, changeCounter, remote)
  else if (isEmpty(local)) adoptRemote(file, remote)
  else if (isEmpty(remote)) {
    markSynced({ id: file.id, ...(await updateFile(file.id, local)) }, changeCounter, local)
  } else if (sameFile && meta.dirty && remoteUnchanged) {
    markSynced({ id: file.id, ...(await updateFile(file.id, local)) }, changeCounter, local)
  } else if (sameFile && !meta.dirty) adoptRemote(file, remote)
  else await mergeWithRemote(file)
}

async function pushLocal() {
  const meta = getMeta()
  if (!meta.connected || !meta.dirty || HOLD_STATES.has(status.state)) return
  const stamp = changeCounter
  try {
    await ensureToken()
    setStatus('saving')
    const snapshot = exportAll()
    const file = await getFileMeta(meta.fileId)
    if (!file && meta.shared) throw new Error(SHARED_GONE_MESSAGE)
    if (!file) return markSynced(await createFile(snapshot), stamp, snapshot)
    if (fileToken(file) !== meta.version) return await mergeWithRemote(file)
    await ensureBase(file)
    markSynced({ id: meta.fileId, ...(await updateFile(meta.fileId, snapshot)) }, stamp, snapshot)
  } catch (error) {
    handleError(error)
  }
}

function schedulePush() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => enqueue(pushLocal), SAVE_DELAY_MS)
}

/** Pulls newer data from Drive (e.g. edited on another Mac) when nothing is waiting to upload. */
function pullIfChanged() {
  return enqueue(async () => {
    const meta = getMeta()
    if (!meta.connected || HOLD_STATES.has(status.state)) return
    try {
      await ensureToken()
      const file = await getFileMeta(meta.fileId)
      if (!file) return
      if (fileToken(file) === meta.version) {
        await ensureBase(file)
        if (meta.dirty) schedulePush()
        else if (status.state !== 'synced') setStatus('synced')
        return
      }
      if (meta.dirty) return await mergeWithRemote(file)
      adoptRemote(file, await downloadFile(file.id))
    } catch (error) {
      handleError(error)
    }
  })
}

// ---------------------------------------------------------------- public actions

/**
 * Starts sync: wires up change tracking and, if Drive was connected before, quietly
 * signs in again and reconciles. Safe to call more than once.
 */
export function initDriveSync() {
  if (initialized || !CLIENT_ID) return
  initialized = true

  loadGis().catch(() => {}) // preload so the sign-in popup can open straight from a click
  if (isPickerConfigured()) loadPicker().catch(() => {})

  subscribe((source) => {
    if (source !== 'local') return
    changeCounter += 1
    if (!getMeta().connected) return
    setMeta({ dirty: true })
    if (!HOLD_STATES.has(status.state)) setStatus('unsynced')
    schedulePush()
  })

  setInterval(() => {
    if (document.visibilityState === 'visible' && !isOffline()) pullIfChanged()
  }, POLL_INTERVAL_MS)

  window.addEventListener('online', () => {
    if (getMeta().dirty) schedulePush()
    pullIfChanged()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (getMeta().dirty) flush()
    } else {
      pullIfChanged()
    }
  })

  if (getMeta().connected) {
    enqueue(async () => {
      try {
        await requestToken('none')
        await reconcile()
      } catch (error) {
        handleError(error)
      }
    })
  }
}

/**
 * Connects to Google Drive (or reconnects after the sign-in expired). Call it directly from a
 * click handler so the browser allows Google's sign-in popup.
 *
 * @returns {Promise<void>}
 */
export function connect() {
  if (!CLIENT_ID) return Promise.resolve()
  setStatus('connecting', 'Waiting for Google sign-in…')
  const auth = requestToken('') // started synchronously, inside the click
  auth.catch(() => {})
  return enqueue(async () => {
    try {
      await auth
      await reconcile()
    } catch (error) {
      // Closing the popup before ever connecting just returns to the Connect button
      if (error instanceof AuthError && !getMeta().connected) setStatus('disconnected')
      else handleError(error)
    }
  })
}

/**
 * Connects to a data file someone else shared with this Google account (or any other
 * `landlordiq-data.json` the user picks), using Google's file picker. Choosing it gives the
 * app access to that one file. Call it directly from a click handler.
 *
 * If this device already has data that differs from the chosen file, the usual
 * "which copy to keep" banner appears; an empty device simply loads the file.
 *
 * @returns {Promise<void>}
 */
export async function openSharedFile() {
  if (!isPickerConfigured()) return
  const wasConnected = getMeta().connected
  const previous = status
  if (!wasConnected) setStatus('connecting', 'Waiting for Google sign-in…')
  const auth = requestToken('') // started synchronously, inside the click
  auth.catch(() => {})

  let fileId = null
  try {
    await auth
    fileId = await pickFile()
  } catch (error) {
    if (error instanceof AuthError && !wasConnected) setStatus('disconnected')
    else if (error instanceof AuthError) setStatus(previous.state, previous.message)
    else handleError(error)
    return
  }
  if (!fileId) {
    setStatus(wasConnected ? previous.state : 'disconnected', wasConnected ? previous.message : '')
    return
  }

  return enqueue(async () => {
    clearTimeout(saveTimer)
    pendingConflict = null
    setBase(null)
    // `dirty` makes a device that already has data compare itself with the chosen file
    setMeta({ connected: true, fileId, version: null, dirty: !isEmpty(), shared: true })
    setStatus('connecting', 'Opening the shared file…')
    try {
      await reconcile()
    } catch (error) {
      handleError(error)
    }
  })
}

/**
 * Uploads any pending local changes right away.
 *
 * @returns {Promise<void>}
 */
export function flush() {
  clearTimeout(saveTimer)
  return enqueue(pushLocal)
}

/**
 * Resolves a sync conflict.
 *
 * @param {'drive' | 'mine'} choice - 'drive' replaces this device's data with the Drive copy
 *   (a backup of this device's data is kept); 'mine' overwrites Drive with this device's data.
 * @returns {Promise<void>}
 */
export function resolveConflict(choice) {
  return enqueue(async () => {
    if (!pendingConflict) return
    const { file, remote } = pendingConflict
    try {
      if (choice === 'drive') {
        adoptRemote(file, remote)
      } else {
        await ensureToken()
        setStatus('saving')
        const stamp = changeCounter
        const snapshot = exportAll()
        markSynced({ id: file.id, ...(await updateFile(file.id, snapshot)) }, stamp, snapshot)
      }
    } catch (error) {
      handleError(error)
    }
  })
}

/**
 * Disconnects from Google Drive and revokes the app's access. Data on this device and the
 * file on Drive are both left untouched.
 *
 * @returns {Promise<void>}
 */
export function disconnect() {
  return enqueue(async () => {
    clearTimeout(saveTimer)
    try {
      if (token) globalThis.window?.google?.accounts?.oauth2?.revoke?.(token.value, () => {})
    } catch {
      // Revoking is best-effort
    }
    token = null
    pendingConflict = null
    setBase(null)
    setMeta({ connected: false, fileId: null, version: null, dirty: false, shared: false })
    setStatus('disconnected')
  })
}
