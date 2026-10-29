import { useSyncExternalStore } from 'react'
import { getTheme, setTheme, subscribeTheme } from '../../data/theme.js'
import { t } from '../../data/i18n.js'

/**
 * ThemeSwitcher — a sun / moon button for the header that toggles light and dark mode.
 * The choice is remembered on this device (see theme.js).
 */
export default function ThemeSwitcher() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme)
  const dark = theme === 'dark'
  const label = dark ? t('Switch to light mode') : t('Switch to dark mode')

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
    >
      {dark ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  )
}
