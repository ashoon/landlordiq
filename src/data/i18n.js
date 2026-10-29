import { getStoredLanguage, setStoredLanguage } from './store.js'
import ES from './translations.es.js'

/** Languages offered in the header: code, label for screen readers and the locale used for dates and numbers. */
export const LANGUAGES = [
  { code: 'en', label: 'English', locale: 'en-US' },
  { code: 'es', label: 'Español', locale: 'es-CO' },
]

const DICTIONARIES = { en: {}, es: ES }

function detectLanguage() {
  const stored = getStoredLanguage()
  if (LANGUAGES.some((l) => l.code === stored)) return stored
  const browser = typeof navigator !== 'undefined' ? navigator.language || '' : ''
  return browser.toLowerCase().startsWith('es') ? 'es' : 'en'
}

let language = detectLanguage()
const listeners = new Set()

/**
 * The current language code, 'en' or 'es'. Chosen from the header flags; the first time the
 * app opens it follows the browser's language.
 *
 * @returns {string}
 */
export function getLanguage() {
  return language
}

/**
 * The locale for dates and numbers in the current language, e.g. 'es-CO'.
 *
 * @returns {string}
 */
export function getLocale() {
  return LANGUAGES.find((l) => l.code === language).locale
}

/**
 * Switches the language, remembers it on this device and tells subscribers to redraw.
 *
 * @param {string} code - 'en' | 'es'
 */
export function setLanguage(code) {
  if (code === language || !LANGUAGES.some((l) => l.code === code)) return
  language = code
  setStoredLanguage(code)
  if (typeof document !== 'undefined') document.documentElement.lang = code
  listeners.forEach((listener) => listener())
}

/**
 * Subscribes to language changes (for useSyncExternalStore).
 *
 * @param {() => void} listener
 * @returns {() => void} unsubscribe
 */
export function subscribeLanguage(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Translates an English text into the current language. The English text is the key, so a
 * text without a translation simply shows in English. `{name}` placeholders are filled from `params`.
 *
 * @param {string} text - English text, e.g. "{n} days overdue"
 * @param {Record<string, string|number>} [params]
 * @returns {string}
 */
export function t(text, params) {
  const translated = DICTIONARIES[language][text] ?? text
  if (!params) return translated
  return translated.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
}

/**
 * Formats a date in the current language, e.g. { month: 'short' } -> "Oct" / "oct.".
 *
 * @param {Date} date
 * @param {Intl.DateTimeFormatOptions} options
 * @returns {string}
 */
export function formatLocaleDate(date, options) {
  return date.toLocaleDateString(getLocale(), options)
}

/**
 * Today's date for the header in the current language, e.g. "October 29, 2026" / "29 de octubre de 2026".
 *
 * @returns {string}
 */
export function formatToday() {
  return capitalize(formatLocaleDate(new Date(), { month: 'long', day: 'numeric', year: 'numeric' }))
}

/**
 * Upper-cases the first letter ("octubre de 2026" -> "Octubre de 2026"), because Spanish
 * month names are written in lower case.
 *
 * @param {string} text
 * @returns {string}
 */
export function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

if (typeof document !== 'undefined') document.documentElement.lang = language
