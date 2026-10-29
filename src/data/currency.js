import { getLocale } from './i18n.js'

/** App-wide currency. Change here to re-denominate every monetary value in the UI. */
const CURRENCY = 'COP'

// Number formats depend on the chosen language (1,850 in English, 1.850 in Spanish), so build them per locale
const wholeFormatters = {}
const milFormatters = {}

function wholeFormatter() {
  const locale = getLocale()
  wholeFormatters[locale] ??= new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: CURRENCY,
    currencyDisplay: 'code', // "COP", not "$", in every language
    maximumFractionDigits: 0,
  })
  return wholeFormatters[locale]
}

function milFormatter() {
  const locale = getLocale()
  milFormatters[locale] ??= new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  return milFormatters[locale]
}

/**
 * Formats a whole-unit monetary amount, e.g. "COP 1,850" (English) or "COP 1.850" (Spanish).
 *
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  return wholeFormatter().format(amount)
}

/**
 * Formats an amount in "mil" (thousands), without a unit: 590000 -> "590",
 * 16545000 -> "16,545", 12500 -> "12.5". Pair with a "COP mil" caption.
 *
 * @param {number} amount
 * @returns {string}
 */
export function formatMil(amount) {
  return milFormatter().format(amount / 1000)
}

/**
 * Converts an amount typed in "mil" (thousands) to whole pesos: "450" -> 450000.
 * Returns NaN for empty or non-numeric input.
 *
 * @param {number|string} mil
 * @returns {number}
 */
export function milToAmount(mil) {
  if (mil === '' || mil == null) return NaN
  return Math.round(Number(mil) * 1000)
}

/**
 * Formats an amount in thousands with its unit inline: 16545000 -> "COP 16,545 mil".
 *
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrencyMil(amount) {
  return `${CURRENCY} ${formatMil(amount)} mil`
}
