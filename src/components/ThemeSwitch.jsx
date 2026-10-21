import { useEffect, useState } from 'react'

// On phones the themes move into the command menu instead, unless always is set
const COMPACT = '(max-width: 600px)'

export default function ThemeSwitch({ themes, theme, back, onChange, onRepeat, always = false }) {
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT).matches)

  useEffect(() => {
    const mq = window.matchMedia(COMPACT)
    const update = () => setCompact(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  if (compact && !always) return null

  return (
    <div className="theme-switch" role="group" aria-label="Color theme">
      {themes.map((t) => {
        const current = theme === t.id
        return (
          <button
            key={t.id}
            type="button"
            className={`theme-switch__option theme-switch__option--${t.id}`}
            aria-pressed={current}
            aria-label={current ? `${t.name} theme. Press again for ${back.name}` : `${t.name} theme`}
            title={current ? `${t.name}. Click again for ${back.name}` : t.name}
            onClick={() => (current ? onRepeat() : onChange(t.id))}
          />
        )
      })}
    </div>
  )
}
