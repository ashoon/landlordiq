import { useSyncExternalStore } from 'react'
import { LANGUAGES, getLanguage, setLanguage, subscribeLanguage, t } from '../../data/i18n.js'

/** Union Jack, drawn as a small inline SVG (flag emoji don't show on Windows). */
function FlagEnglish() {
  return (
    <svg viewBox="0 0 60 30" className="h-4 w-8 rounded-sm" aria-hidden="true" preserveAspectRatio="none">
      <clipPath id="flag-en-box">
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id="flag-en-cross">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clipPath="url(#flag-en-box)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#flag-en-cross)" stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  )
}

/** Flag of Spain: red, yellow, red bands. */
function FlagSpanish() {
  return (
    <svg viewBox="0 0 60 30" className="h-4 w-8 rounded-sm" aria-hidden="true" preserveAspectRatio="none">
      <rect width="60" height="30" fill="#AA151B" />
      <rect y="7.5" width="60" height="15" fill="#F1BF00" />
    </svg>
  )
}

const FLAGS = { en: FlagEnglish, es: FlagSpanish }

/**
 * LanguageSwitcher — two flag buttons for the header: English and Spanish. The choice is
 * remembered on this device (see i18n.js) and redraws the whole app.
 */
export default function LanguageSwitcher() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage)

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('Language')}>
      {LANGUAGES.map((l) => {
        const Flag = FLAGS[l.code]
        const active = l.code === language
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => setLanguage(l.code)}
            aria-pressed={active}
            aria-label={l.label}
            title={l.label}
            className={`rounded p-1 border-2 transition-opacity ${
              active ? 'border-brand-600 opacity-100' : 'border-transparent opacity-50 hover:opacity-100'
            }`}
          >
            <Flag />
          </button>
        )
      })}
    </div>
  )
}
