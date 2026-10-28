/**
 * seedUnits.js — loads the landlord's starting tenant list from the git-ignored
 * `private/tenants.json`, for the one-time import into saved data (see migrateSeedUnits in
 * tenants.js).
 *
 * This only works in development (`npm run dev`) and only when that file exists. In a
 * production build the branch below is removed, so tenant data is never part of the
 * published JavaScript.
 *
 * @returns {Promise<Array<Object> | null>} the tenant list, or null when unavailable
 */
export async function loadSeedUnits() {
  if (!import.meta.env.DEV) return null
  const files = import.meta.glob('../../private/tenants.json', { import: 'default' })
  const load = Object.values(files)[0]
  return load ? load() : null
}
