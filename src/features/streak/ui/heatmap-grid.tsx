import type { VisualBook } from '@/features/bookshelf/model/use-bookshelf-books'

import { CELL, EMPTY_CELL_COLOR, GAP, STEP, cellColor } from '../config/constants'
import type { ThemeName } from '../config/constants'
import type { WeekCol } from '../model/types'

interface Props {
  year: number
  weeks: WeekCol[]
  booksByDate: Map<string, VisualBook[]>
  theme: ThemeName
}

export function HeatmapGrid({ year, weeks, booksByDate, theme }: Props) {
  const gridW = weeks.length * STEP - GAP

  return (
    <div className="flex items-start gap-2">
      <div
        className="w-9 shrink-0 text-right text-xs font-semibold text-stone-400"
        style={{ paddingTop: 14 + GAP }}
      >
        {year}
      </div>

      <div>
        {/* Month labels */}
        <div className="relative mb-1" style={{ width: gridW, height: 14 }}>
          {weeks.map((w, wi) =>
            w.monthLabel ? (
              <span
                key={wi}
                className="absolute text-[10px] leading-none text-stone-400"
                style={{ left: wi * STEP }}
              >
                {w.monthLabel}
              </span>
            ) : null
          )}
        </div>

        {/* Cell grid */}
        <div className="flex" style={{ gap: GAP }}>
          {weeks.map((w, wi) => (
            <div key={wi} className="flex flex-col" style={{ gap: GAP }}>
              {w.cells.map((cell, di) => {
                const tooltip =
                  cell.future || cell.count === 0
                    ? ''
                    : [
                        `${cell.date} · ${cell.count}편`,
                        ...(booksByDate.get(cell.date) ?? []).map(
                          (book, idx) => `${idx + 1}. ${book.title}`
                        ),
                      ].join('\n')

                return (
                  <div
                    key={di}
                    title={tooltip}
                    style={{
                      width: CELL,
                      height: CELL,
                      borderRadius: 2,
                      flexShrink: 0,
                      backgroundColor: cell.future
                        ? 'transparent'
                        : cell.count === 0
                          ? EMPTY_CELL_COLOR
                          : cellColor(cell.count, theme),
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
