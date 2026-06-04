import type { VisualBook } from '@/features/bookshelf/model/use-bookshelf-books'

export type BiasMetric = 'count' | 'length'

export interface CategoryBias {
  category: string
  color: string
  count: number
  totalLength: number
  ratio: number // 0–1 (선택된 metric 기준)
}

export interface BiasSnapshot {
  categories: CategoryBias[] // ratio desc
  total: number
  topShare: number // 가장 큰 카테고리의 비율
  diversity: number // 0–1, 1에 가까울수록 고르게 분포 (정규화된 엔트로피)
}

const RECENT_MONTHS = 3
const MAX_AXES = 7 // 그 이상은 "기타"로 묶음

export function filterRecent(books: VisualBook[], months = RECENT_MONTHS): VisualBook[] {
  if (books.length === 0) return books
  const latest = books.reduce((a, b) => (a.date > b.date ? a : b)).date
  const [y, m, d] = latest.split('-').map(Number)
  const cutoff = new Date(Date.UTC(y, m - 1 - months, d))
  return books.filter((b) => {
    const [by, bm, bd] = b.date.split('-').map(Number)
    return new Date(Date.UTC(by, bm - 1, bd)) >= cutoff
  })
}

export function computeBias(books: VisualBook[], metric: BiasMetric = 'count'): BiasSnapshot {
  const map = new Map<string, { color: string; count: number; totalLength: number }>()
  for (const b of books) {
    const cur = map.get(b.category) ?? { color: b.style.color, count: 0, totalLength: 0 }
    cur.count += 1
    cur.totalLength += b.contentLength
    map.set(b.category, cur)
  }

  const rows: CategoryBias[] = [...map.entries()].map(([category, v]) => ({
    category,
    color: v.color,
    count: v.count,
    totalLength: v.totalLength,
    ratio: 0,
  }))

  const denom =
    metric === 'count'
      ? rows.reduce((s, r) => s + r.count, 0)
      : rows.reduce((s, r) => s + r.totalLength, 0)
  for (const r of rows) {
    const v = metric === 'count' ? r.count : r.totalLength
    r.ratio = denom > 0 ? v / denom : 0
  }

  rows.sort((a, b) => b.ratio - a.ratio)

  const limited =
    rows.length > MAX_AXES
      ? [
          ...rows.slice(0, MAX_AXES - 1),
          rows.slice(MAX_AXES - 1).reduce<CategoryBias>(
            (acc, r) => ({
              category: '기타',
              color: '#9CA3AF',
              count: acc.count + r.count,
              totalLength: acc.totalLength + r.totalLength,
              ratio: acc.ratio + r.ratio,
            }),
            { category: '기타', color: '#9CA3AF', count: 0, totalLength: 0, ratio: 0 },
          ),
        ]
      : rows

  // Shannon entropy 정규화 → 균등 분포 = 1, 한쪽 쏠림 = 0
  const entropy = limited.reduce((s, r) => (r.ratio > 0 ? s - r.ratio * Math.log2(r.ratio) : s), 0)
  const maxEntropy = Math.log2(Math.max(limited.length, 1))
  const diversity = maxEntropy > 0 ? entropy / maxEntropy : 0

  return {
    categories: limited,
    total: books.length,
    topShare: limited[0]?.ratio ?? 0,
    diversity,
  }
}
