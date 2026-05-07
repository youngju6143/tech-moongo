import { cellColor, type ThemeName } from '../config/constants'

interface Props {
  theme: ThemeName
}

export function HeatmapLegend({ theme }: Props) {
  return (
    <div className="mt-2 flex items-center justify-end gap-1">
      <span className="text-[10px] text-stone-400">적음</span>
      {([0, 1, 2, 3, 4] as const).map((n) => (
        <div
          key={n}
          style={{
            width: 9,
            height: 9,
            borderRadius: 2,
            backgroundColor: cellColor(n, theme),
          }}
        />
      ))}
      <span className="text-[10px] text-stone-400">많음</span>
    </div>
  )
}
