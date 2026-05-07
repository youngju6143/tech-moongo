import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'

import type { VisualBook } from '../bookshelf/model/use-bookshelf-books'
import { type ThemeName } from './config/constants'
import { buildYearSections } from './model/build-year-sections'
import { longestDayStreak, thisMonthCount } from './model/stats'
import { HeatmapGrid } from './ui/heatmap-grid'
import { HeatmapLegend } from './ui/heatmap-legend'
import { StreakStats } from './ui/streak-stats'
import { ThemePicker } from './ui/theme-picker'
import { YearTabs } from './ui/year-tabs'

export function ActivityHeatmap({ books }: { books: VisualBook[] }) {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeName>('블루')
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const countByDate = new Map<string, number>()
  const booksByDate = new Map<string, VisualBook[]>()
  books.forEach((b) => countByDate.set(b.date, (countByDate.get(b.date) ?? 0) + 1))
  books.forEach((b) => {
    const list = booksByDate.get(b.date) ?? []
    list.push(b)
    booksByDate.set(b.date, list)
  })

  if (countByDate.size === 0) return null

  const sections = buildYearSections(countByDate)
  const activeYear = selectedYear ?? sections[sections.length - 1]?.year
  const streak = longestDayStreak([...countByDate.keys()])
  const monthCount = thisMonthCount(books)

  return (
    <div className="fixed bottom-4 left-4 z-40 select-none">
      <div className="rounded-2xl border border-stone-200/60 bg-white/92 shadow-2xl backdrop-blur-md">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-6 px-4 py-3 text-left"
        >
          <span className="text-sm font-semibold text-stone-700">글쓰기 활동</span>
          <span className="text-[10px] text-stone-400">{open ? '▲' : '▼'}</span>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="activity-panel-outer"
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <motion.div
                key="activity-panel-inner"
                initial={{ clipPath: 'inset(0% 100% 100% 0%)', opacity: 0 }}
                animate={{ clipPath: 'inset(0% 0% 0% 0%)', opacity: 1 }}
                exit={{ clipPath: 'inset(0% 100% 100% 0%)', opacity: 0 }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
                className="border-t border-stone-100 px-4 pt-3 pb-4"
              >
                <YearTabs
                  years={sections.map((s) => s.year)}
                  activeYear={activeYear}
                  onSelect={setSelectedYear}
                />

                <div className="flex flex-col gap-3">
                  {sections
                    .filter((s) => s.year === activeYear)
                    .map(({ year, weeks }) => (
                      <HeatmapGrid
                        key={year}
                        year={year}
                        weeks={weeks}
                        booksByDate={booksByDate}
                        theme={theme}
                      />
                    ))}
                </div>

                <HeatmapLegend theme={theme} />
                <ThemePicker theme={theme} onChange={setTheme} />
                <StreakStats total={books.length} monthCount={monthCount} streak={streak} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
