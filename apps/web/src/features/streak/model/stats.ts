import type { VisualBook } from '@/features/bookshelf/model/use-bookshelf-books'

export function longestDayStreak(dates: string[]): number {
  if (dates.length === 0) return 0
  const sorted = [...dates].sort()
  let best = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff =
      (new Date(sorted[i] + 'T00:00:00').getTime() -
        new Date(sorted[i - 1] + 'T00:00:00').getTime()) /
      86_400_000
    if (diff === 1) {
      run++
      if (run > best) best = run
    } else {
      run = 1
    }
  }
  return best
}

export function thisMonthCount(books: VisualBook[]): number {
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return books.filter((b) => b.date.startsWith(ym)).length
}
