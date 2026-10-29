/**
 * store.js — the single place all persisted app data is read and written.
 *
 * Every data set lives in an in-memory cache that is written through to
 * localStorage, which doubles as the offline copy. Reads stay synchronous so the
 * UI code is unchanged. Listeners are told whether a change was made here
 * ('local') or arrived from outside ('remote': Google Drive, another tab, import),
 * which is how driveSync.js knows what to upload and how the UI knows to re-read.
 */

const SPECS = {
  settings: { key: 'landlordiq_settings', array: false },
  units: { key: 'landlordiq_units', array: false },
  tenancies: { key: 'landlordiq_tenancies', array: false },
  payments: { key: 'landlordiq_payments', array: false },
  expenses: { key: 'landlordiq_expenses', array: true },
  taxes: { key: 'landlordiq_taxes', array: true },
}

const NAMES = Object.keys(SPECS)

/** Serialized values, loaded lazily from localStorage. */
const cache = {}
const listeners = new Set()

const emptyValue = (name) => (SPECS[name].array ? [] : {})

function emit(source) {
  listeners.forEach((listener) => listener(source))
}

function readRaw(name) {
  if (!(name in cache)) {
    try {
      cache[name] = localStorage.getItem(SPECS[name].key)
    } catch {
      cache[name] = null
    }
  }
  return cache[name]
}

function writeRaw(name, value) {
  const raw = JSON.stringify(value)
  cache[name] = raw
  try {
    localStorage.setItem(SPECS[name].key, raw)
  } catch {
    // Storage full or blocked: the in-memory copy still works for this session
  }
}

/**
 * Returns a fresh copy of a data set (safe to mutate before calling setData).
 *
 * @param {'settings' | 'units' | 'tenancies' | 'payments' | 'expenses' | 'taxes'} name
 * @returns {Object | Array}
 */
export function getData(name) {
  const raw = readRaw(name)
  return raw ? JSON.parse(raw) : emptyValue(name)
}

/**
 * Replaces a data set and notifies listeners of a local change.
 *
 * @param {'settings' | 'units' | 'tenancies' | 'payments' | 'expenses' | 'taxes'} name
 * @param {Object | Array} value
 */
export function setData(name, value) {
  writeRaw(name, value)
  emit('local')
}

/**
 * Returns every data set, e.g. for uploading to Google Drive.
 *
 * @returns {{ settings: Object, units: Object, tenancies: Object, payments: Object, expenses: Array, taxes: Array }}
 */
export function exportAll() {
  return Object.fromEntries(NAMES.map((name) => [name, getData(name)]))
}

/**
 * Replaces every data set from an exported object (missing sets become empty) and
 * notifies listeners of a 'remote' change. Validates everything before writing, so
 * a bad file never leaves the store half-updated.
 *
 * @param {Object} data
 */
export function importAll(data) {
  if (!data || typeof data !== 'object') throw new Error('The data file is not valid.')
  for (const name of NAMES) {
    const value = data[name]
    if (value === undefined) continue
    const ok = SPECS[name].array
      ? Array.isArray(value)
      : value !== null && typeof value === 'object' && !Array.isArray(value)
    if (!ok) throw new Error(`The data file has an invalid "${name}" section.`)
  }
  for (const name of NAMES) writeRaw(name, data[name] ?? emptyValue(name))
  emit('remote')
}

function isBlank(value) {
  if (value == null) return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.values(value).every(isBlank)
  return false
}

/**
 * True when nothing has been entered yet (a brand-new browser). Settings are ignored: they
 * are written automatically on first run, so they don't count as user data.
 *
 * @param {Object} [data] - an exported data object; defaults to the current store contents
 * @returns {boolean}
 */
export function isEmpty(data = exportAll()) {
  return NAMES.every((name) => name === 'settings' || isBlank(data?.[name]))
}

/**
 * Returns an exported data object with every set present (missing ones empty).
 *
 * @param {Object} [data]
 * @returns {{ settings: Object, units: Object, tenancies: Object, payments: Object, expenses: Array, taxes: Array }}
 */
export function fillData(data) {
  return Object.fromEntries(NAMES.map((name) => [name, data?.[name] ?? emptyValue(name)]))
}

const BACKUP_KEY = 'landlordiq_local_backup'

/**
 * Keeps one safety copy of the current data on this device (replacing any earlier one),
 * used before local data is replaced by what is on Google Drive.
 */
export function saveLocalBackup() {
  try {
    localStorage.setItem(
      BACKUP_KEY,
      JSON.stringify({ savedAt: new Date().toISOString(), data: exportAll() }),
    )
  } catch {
    // Storage blocked or full: nothing more we can do
  }
}

const META_KEY = 'landlordiq_drive_meta'
const META_DEFAULTS = {
  connected: false,
  fileId: null,
  version: null,
  dirty: false,
  lastSynced: null,
  shared: false,
  loginHint: null,
}
let metaCache = null

/**
 * Google Drive sync bookkeeping. Kept apart from the app data: it is never uploaded.
 * `dirty` means there are local changes Drive hasn't received yet. `loginHint` is the Google
 * account's email, passed to Google on sign-in so it can skip the account picker.
 *
 * @returns {{ connected: boolean, fileId: string|null, version: string|null, dirty: boolean, lastSynced: string|null, shared: boolean, loginHint: string|null }}
 */
export function getMeta() {
  if (!metaCache) {
    let stored = {}
    try {
      stored = JSON.parse(localStorage.getItem(META_KEY) || '{}')
    } catch {
      stored = {}
    }
    metaCache = { ...META_DEFAULTS, ...stored }
  }
  return { ...metaCache }
}

/**
 * Updates the Drive sync bookkeeping.
 *
 * @param {Partial<ReturnType<typeof getMeta>>} patch
 * @returns {ReturnType<typeof getMeta>}
 */
export function setMeta(patch) {
  metaCache = { ...getMeta(), ...patch }
  try {
    localStorage.setItem(META_KEY, JSON.stringify(metaCache))
  } catch {
    // Storage blocked: bookkeeping lives in memory for this session
  }
  return { ...metaCache }
}

const LANGUAGE_KEY = 'landlordiq_language'

/**
 * The language chosen on this device ('en' | 'es'), or null if none was chosen yet.
 * A personal preference: kept out of the synced data so each person keeps their own.
 *
 * @returns {string|null}
 */
export function getStoredLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_KEY)
  } catch {
    return null
  }
}

/**
 * Remembers the language chosen on this device.
 *
 * @param {string} language - 'en' | 'es'
 */
export function setStoredLanguage(language) {
  try {
    localStorage.setItem(LANGUAGE_KEY, language)
  } catch {
    // Storage blocked: the choice lasts for this session only
  }
}

const BASE_KEY = 'landlordiq_drive_base'

/**
 * The data as last agreed with Google Drive. It is the common ancestor for merging when both
 * this device and Drive have changed. Never uploaded.
 *
 * @returns {Object|null} an exported data object, or null when unknown
 */
export function getBase() {
  try {
    return JSON.parse(localStorage.getItem(BASE_KEY) || 'null')
  } catch {
    return null
  }
}

/**
 * Remembers the data as last agreed with Google Drive (null forgets it).
 *
 * @param {Object|null} data
 */
export function setBase(data) {
  try {
    if (data) localStorage.setItem(BASE_KEY, JSON.stringify(data))
    else localStorage.removeItem(BASE_KEY)
  } catch {
    // Storage blocked or full: merges fall back to a union without deletions
  }
}

/**
 * Subscribes to data changes. The listener receives 'local' for changes made through
 * setData and 'remote' for changes that arrived from elsewhere.
 *
 * @param {(source: 'local' | 'remote') => void} listener
 * @returns {() => void} unsubscribe
 */
export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Another tab edited localStorage: drop our cached copy and tell the UI to re-read
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', (event) => {
    const name = NAMES.find((n) => SPECS[n].key === event.key)
    if (!name) return
    delete cache[name]
    emit('remote')
  })
}
