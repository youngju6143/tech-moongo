import type { WeekCol, YearSection } from './types'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function shiftDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function buildYearSections(countByDate: Map<string, number>): YearSection[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const firstStr = [...countByDate.keys()].sort()[0]
  const firstDate = new Date(firstStr + 'T00:00:00')
  const gridStart = shiftDays(firstDate, -firstDate.getDay())

  const yearMap = new Map<number, WeekCol[]>()
  let cursor = new Date(gridStart)
  let prevMonth = -1
  let prevYear = -1

  while (cursor <= today) {
    const weekYear = cursor.getFullYear()

    if (weekYear !== prevYear) {
      prevMonth = -1
      prevYear = weekYear
    }

    const cells = []
    let monthLabel: string | null = null

    for (let d = 0; d < 7; d++) {
      const day = shiftDays(cursor, d)
      const inYear = day.getFullYear() === weekYear
      const month = day.getMonth()
      if (inYear && month !== prevMonth) {
        monthLabel = String(month + 1)
        prevMonth = month
      }
      cells.push({
        date: isoDate(day),
        count: inYear ? (countByDate.get(isoDate(day)) ?? 0) : 0,
        future: day > today || !inYear,
      })
    }

    if (!yearMap.has(weekYear)) yearMap.set(weekYear, [])
    yearMap.get(weekYear)!.push({ cells, monthLabel })
    cursor = shiftDays(cursor, 7)
  }

  return [...yearMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, weeks]) => ({ year, weeks }))
}
