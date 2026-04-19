import { useQuery } from '@tanstack/react-query'

import { fetchPublicBooks } from '@/shared/services/notion'
import type { BookEntry } from '@/shared/services/notion'

// ── Category → visual style mapping ──────────────────────────────────────────
interface BookStyle {
  color:   string
  accent:  string
  pattern: 'plain' | 'striped' | 'bordered' | 'embossed'
}

const CATEGORY_STYLE_MAP: Record<string, BookStyle> = {
  Algorithm: { color: '#2C5F8C', accent: '#AED6F1', pattern: 'striped'  },
  Web:       { color: '#1E8449', accent: '#ABEBC6', pattern: 'bordered' },
  Database:  { color: '#7E5109', accent: '#F5CBA7', pattern: 'embossed' },
  Network:   { color: '#6C3483', accent: '#D7BDE2', pattern: 'striped'  },
  OS:        { color: '#117A65', accent: '#A2D9CE', pattern: 'bordered' },
  CS:        { color: '#1C2833', accent: '#85929E', pattern: 'plain'    },
  DevOps:    { color: '#922B21', accent: '#FDEDEC', pattern: 'embossed' },
  Python:    { color: '#D4810D', accent: '#FDEBD0', pattern: 'striped'  },
  JavaScript:{ color: '#9A7D0A', accent: '#FEF9E7', pattern: 'bordered' },
  TypeScript:{ color: '#154360', accent: '#D6EAF8', pattern: 'plain'    },
}

// Fallback: generate a stable color from category string hash
function hashColor(str: string): BookStyle {
  let hash = 0
  for (const ch of str) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const hue = hash % 360
  return {
    color:   `hsl(${hue}, 55%, 30%)`,
    accent:  `hsl(${hue}, 40%, 80%)`,
    pattern: (['plain', 'striped', 'bordered', 'embossed'] as const)[hash % 4],
  }
}

export function getBookStyle(category: string): BookStyle {
  return CATEGORY_STYLE_MAP[category] ?? hashColor(category)
}

// ── Derived visual dimensions ─────────────────────────────────────────────────
// Height  ← titleLen  (normalized to 0.45 – 0.70)
// Thickness ← tagCount (0 tags→0.07, 1-2→0.09, 3→0.11, 4+→0.13)
export function bookHeight(titleLen: number): number {
  const normalized = Math.min(Math.max((titleLen - 5) / 75, 0), 1)
  return 0.45 + normalized * 0.25
}

export function bookThickness(tagCount: number): number {
  if (tagCount === 0) return 0.07
  if (tagCount <= 2)  return 0.09
  if (tagCount === 3) return 0.11
  return 0.13
}

// ── TanStack Query hook ───────────────────────────────────────────────────────
export interface VisualBook extends BookEntry {
  style:     BookStyle
  height:    number
  thickness: number
  shelfIndex: number  // which shelf row (0 = bottom, 1 = top, ...)
}

const MAX_PER_SHELF = 20

export function useBookshelfBooks() {
  return useQuery({
    queryKey: ['bookshelf-books'],
    queryFn: async (): Promise<VisualBook[]> => {
      const entries = await fetchPublicBooks()

      return entries.map((e, i) => ({
        ...e,
        style:      getBookStyle(e.category),
        height:     bookHeight(e.titleLen),
        thickness:  bookThickness(e.tagCount),
        shelfIndex: Math.floor(i / MAX_PER_SHELF),
      }))
    },
    staleTime: 1000 * 60 * 5,
  })
}
