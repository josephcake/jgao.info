export default function ThemeSwitch({ themes, theme, back, onChange, onRepeat }) {
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
