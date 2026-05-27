import { THEMES, type ThemeName } from '../config/constants'

interface Props {
  theme: ThemeName
  onChange: (theme: ThemeName) => void
}

export function ThemePicker({ theme, onChange }: Props) {
  return (
    <div className="mt-3 flex items-center gap-2 border-t border-stone-100 pt-3">
      <span className="shrink-0 text-[10px] text-stone-400">색상</span>
      <div className="flex gap-1.5">
        {(Object.keys(THEMES) as ThemeName[]).map((name) => (
          <button
            key={name}
            onClick={() => onChange(name)}
            title={name}
            className="flex h-5 w-5 items-center justify-center rounded-full transition-transform hover:scale-110"
            style={{
              backgroundColor: THEMES[name][3],
              outline: theme === name ? `2px solid ${THEMES[name][4]}` : 'none',
              outlineOffset: 1,
            }}
          >
            {theme === name && (
              <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
