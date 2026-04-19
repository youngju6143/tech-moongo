import { useQuery } from '@tanstack/react-query'

import { fetchPublicBooks } from '@/shared/services/notion'
import type { BookEntry } from '@/shared/services/notion'

// ── Category → visual style mapping ──────────────────────────────────────────
interface BookStyle {
  color:   string
  accent:  string
  pattern: 'plain' | 'striped' | 'bordered' | 'embossed'
}

function pastelStyle(category: string): BookStyle {
  let hash = 0
  for (const ch of category) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const hue = hash % 360
  const patterns = ['plain', 'striped', 'bordered', 'embossed'] as const
  return {
    color:   `hsl(${hue}, 50%, 72%)`,
    accent:  `hsl(${hue}, 35%, 40%)`,
    pattern: patterns[hash % 4],
  }
}

export function getBookStyle(category: string): BookStyle {
  return pastelStyle(category)
}

// ── Derived visual dimensions ─────────────────────────────────────────────────
export function bookHeight(titleLen: number): number {
  const normalized = Math.min(Math.max((titleLen - 5) / 75, 0), 1)
  return 0.60 + normalized * 0.35
}

// Slightly thicker than before for better spine readability
export function bookThickness(tagCount: number): number {
  if (tagCount === 0) return 0.10
  if (tagCount <= 2)  return 0.13
  if (tagCount === 3) return 0.16
  return 0.20
}

// ── TanStack Query hook ───────────────────────────────────────────────────────
export interface VisualBook extends BookEntry {
  style:                BookStyle
  height:               number
  thickness:            number
  shelfIndex:           number
  bookcaseIndex:        number
  shelfIndexInBookcase: number
}

const MAX_PER_SHELF = 20

export function useBookshelfBooks() {
  return useQuery({
    queryKey: ['bookshelf-books'],
    queryFn: async (): Promise<VisualBook[]> => {
      const entries = await fetchPublicBooks()

      // Group by category, sort within each group by date
      const groups = new Map<string, BookEntry[]>()
      entries.forEach(e => {
        const arr = groups.get(e.category) ?? []
        arr.push(e)
        groups.set(e.category, arr)
      })

      // Categories sorted alphabetically for stable shelf order
      const sortedCats = [...groups.keys()].sort()

      const result: VisualBook[] = []
      let shelfIndex = 0

      sortedCats.forEach(cat => {
        const catBooks = groups.get(cat)!.sort((a, b) => a.date.localeCompare(b.date))
        catBooks.forEach((e, i) => {
          if (i > 0 && i % MAX_PER_SHELF === 0) shelfIndex++
          result.push({
            ...e,
            style:                getBookStyle(cat),
            height:               bookHeight(e.titleLen),
            thickness:            bookThickness(e.tagCount),
            shelfIndex,
            bookcaseIndex:        Math.floor(shelfIndex / 5),
            shelfIndexInBookcase: shelfIndex % 5,
          })
        })
        shelfIndex++ // next category always starts on a new shelf
      })

      return result
    },
    staleTime: 1000 * 60 * 5,
  })
}
