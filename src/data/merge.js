/**
 * merge.js — three-way merge of two edited copies of the app data.
 *
 * Used by driveSync.js when this device and Google Drive both changed since they last agreed.
 * `base` is the copy both sides started from (the last synced data), `local` is this device's
 * copy and `remote` is the one on Drive. Each record is merged on its own, so two people
 * changing different things (or different fields of the same record) never clash:
 *
 *   - a record or field changed on only one side keeps that change (including deletions);
 *   - records are matched by key (payments, tenancies) or by `id` (units, expenses, taxes);
 *   - changed on both sides to different values: this device's value wins, except that an edit
 *     beats a deletion made on the other side;
 *   - without a base (`{}`), nothing counts as deleted, so the result is the union of both.
 */
import { fillData } from './store.js'

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

/** Lists whose items all have an `id` are merged item by item; other arrays are treated as one value. */
const isIdList = (value) =>
  Array.isArray(value) && value.every((item) => isObject(item) && item.id !== undefined && item.id !== null)

/**
 * Order-independent JSON, so equal data compares equal.
 *
 * @param {*} value
 * @returns {string}
 */
export function stable(value) {
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function mergeValue(base, local, remote) {
  if (stable(local) === stable(remote)) return local
  if (stable(local) === stable(base)) return remote
  if (stable(remote) === stable(base)) return local
  // Both sides changed it differently
  if (local === undefined) return remote
  if (remote === undefined) return local
  if (isObject(local) && isObject(remote)) return mergeMap(isObject(base) ? base : {}, local, remote)
  if (isIdList(local) && isIdList(remote)) return mergeList(isIdList(base) ? base : [], local, remote)
  return local
}

function mergeMap(base, local, remote) {
  const merged = {}
  for (const key of new Set([...Object.keys(remote), ...Object.keys(local)])) {
    const value = mergeValue(base[key], local[key], remote[key])
    if (value !== undefined) merged[key] = value
  }
  return merged
}

function mergeList(base, local, remote) {
  const byId = (list) => new Map(list.map((item) => [String(item.id), item]))
  const [baseById, localById, remoteById] = [base, local, remote].map(byId)
  const merged = []
  for (const id of new Set([...remoteById.keys(), ...localById.keys()])) {
    const item = mergeValue(baseById.get(id), localById.get(id), remoteById.get(id))
    if (item !== undefined) merged.push(item)
  }
  return merged
}

/**
 * Merges two edited copies of the app data.
 *
 * @param {Object|null} base - the last synced data (null/empty when unknown)
 * @param {Object} local - this device's data
 * @param {Object} remote - the data on Google Drive
 * @returns {Object} merged data, with every set present
 */
export function mergeData(base, local, remote) {
  const [b, l, r] = [base, local, remote].map(fillData)
  const merged = {}
  for (const name of Object.keys(l)) merged[name] = mergeValue(b[name], l[name], r[name])

  // Tracking starts at the earliest month either side has recorded
  const starts = [l.settings.trackingStart, r.settings.trackingStart].filter(Boolean).sort()
  if (starts.length) merged.settings = { ...merged.settings, trackingStart: starts[0] }
  return merged
}
