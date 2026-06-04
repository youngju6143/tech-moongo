import { useQuery } from '@tanstack/react-query'

import {
  computeActivityScores,
  computeDepthScores,
  computeLengthScores,
  computeTotalScore,
  depthToPattern,
  lengthToThickness,
} from '@/shared/lib/scoring'
import { fetchBookSimilarity, fetchPublicBooks } from '@/shared/services/notion'
import type { BookEntry } from '@/shared/services/notion'

// ── Category → color mapping (8-color fixed palette, hash-based) ──────────────
const BOOK_COLOR_PALETTE = [
  '#A80032', // crimson
  '#18662D', // forest green
  '#0B78A6', // steel blue
  '#1E377D', // dark navy
  '#56376F', // deep purple
  '#7D2873', // dark mauve
  '#222222', // charcoal
]

interface BookStyle {
  color: string
  accent: string
  pattern: 'plain' | 'striped' | 'bordered' | 'embossed'
}

function categoryStyle(category: string): Omit<BookStyle, 'pattern'> {
  let hash = 0
  for (const ch of category) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const color = BOOK_COLOR_PALETTE[hash % BOOK_COLOR_PALETTE.length]
  return { color, accent: color }
}

export function getBookStyle(
  category: string,
  depthScore: number,
  patternOverride?: BookStyle['pattern']
): BookStyle {
  return {
    ...categoryStyle(category),
    // data_analysis.md §4: 질감/스타일 ← DepthScore
    pattern: patternOverride ?? depthToPattern(depthScore),
  }
}

// Book height driven by title length (visual variety; not in data_analysis.md spec)
export function bookHeight(titleLen: number): number {
  const normalized = Math.min(Math.max((titleLen - 5) / 75, 0), 1)
  return 0.6 + normalized * 0.35
}

// ── VisualBook: BookEntry + computed visual + score fields ────────────────────
export interface VisualBook extends BookEntry {
  style: BookStyle
  height: number
  thickness: number
  shelfIndex: number
  bookcaseIndex: number
  shelfIndexInBookcase: number
  // Normalized scores (0–1) from data_analysis.md
  lengthScore: number
  depthScore: number
  activityScore: number
  totalScore: number
  // TF-IDF 기반 유사도 분석 결과
  topTerms: string[]       // 이 글의 대표 키워드 (TF-IDF 상위 5개)
  clusterIndex: number     // 같은 클러스터 = 비슷한 주제 그룹
  similarBooks: Array<{ title: string; score: number }>  // 코사인 유사도 상위 3개
}

const MAX_PER_SHELF = 20

export function useBookshelfBooks(dbId?: string) {
  return useQuery({
    queryKey: ['bookshelf-books', dbId ?? 'default'],
    queryFn: async (): Promise<VisualBook[]> => {
      const entries = await fetchPublicBooks(dbId)
      if (entries.length === 0) return []

      // ── TF-IDF 유사도 분석 (백엔드에서 Kiwi 형태소 분석 + 코사인 유사도 계산) ──
      // 실패해도 나머지 시각화는 정상 동작하도록 graceful fallback
      const similarity = await fetchBookSimilarity(entries.map((e) => ({ id: e.id, title: e.title })))

      // doc_id → clusterIndex 매핑
      const clusterMap = new Map<string, number>()
      similarity?.clusters.forEach((cluster, idx) => {
        cluster.forEach((docId) => clusterMap.set(docId, idx))
      })

      // doc_id → 코사인 유사도 상위 3개 이웃 계산
      // similarity_matrix[i][j] = i번째 문서와 j번째 문서의 코사인 유사도 (0~1)
      // 자기 자신(대각선 = 1.0)을 제외하고 점수 높은 순으로 정렬
      const similarBooksMap = new Map<string, Array<{ title: string; score: number }>>()
      if (similarity) {
        const { docIds, similarityMatrix } = similarity
        const idToTitle = new Map(entries.map((e) => [e.id, e.title]))
        docIds.forEach((docId, i) => {
          const neighbors = docIds
            .map((otherId, j) => ({ id: otherId, score: similarityMatrix[i][j] }))
            .filter(({ id, score }) => id !== docId && score >= 0.1)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(({ id, score }) => ({ title: idToTitle.get(id) ?? id, score }))
          similarBooksMap.set(docId, neighbors)
        })
      }

      // ── Batch score computation (all scores need the full dataset) ──────────
      const lengthScores = computeLengthScores(entries.map((e) => e.contentLength))
      const depthScores = computeDepthScores(entries)
      const activityScores = computeActivityScores(entries)

      // Depth tiers by rank ensure visible specialization differences.
      const depthRanked = depthScores
        .map((score, idx) => ({ score, idx }))
        .sort((a, b) => a.score - b.score)
      const depthTierByIndex: Array<BookStyle['pattern']> = Array(depthScores.length).fill('plain')
      depthRanked.forEach((item, rank) => {
        const q = (rank + 1) / depthRanked.length
        if (q <= 0.25) depthTierByIndex[item.idx] = 'plain'
        else if (q <= 0.5) depthTierByIndex[item.idx] = 'bordered'
        else if (q <= 0.75) depthTierByIndex[item.idx] = 'striped'
        else depthTierByIndex[item.idx] = 'embossed'
      })

      // ── Group by category, preserve date sort within each group ─────────────
      const groups = new Map<string, Array<{ entry: BookEntry; idx: number }>>()
      entries.forEach((e, idx) => {
        const arr = groups.get(e.category) ?? []
        arr.push({ entry: e, idx })
        groups.set(e.category, arr)
      })

      const sortedCats = [...groups.keys()].sort()

      const result: VisualBook[] = []
      let shelfIndex = 0

      sortedCats.forEach((cat) => {
        const catItems = groups.get(cat)!.sort((a, b) => a.entry.date.localeCompare(b.entry.date))

        catItems.forEach(({ entry: e, idx }, i) => {
          if (i > 0 && i % MAX_PER_SHELF === 0) shelfIndex++

          const lScore = lengthScores[idx]
          const dScore = depthScores[idx]
          const aScore = activityScores[idx]

          result.push({
            ...e,
            // data_analysis.md §4 design mapping:
            style: getBookStyle(cat, dScore, depthTierByIndex[idx]),
            height: bookHeight(e.titleLen),
            thickness: lengthToThickness(lScore), // Size=length score
            shelfIndex,
            bookcaseIndex: Math.floor(shelfIndex / 4),
            shelfIndexInBookcase: shelfIndex % 4,
            lengthScore: lScore,
            depthScore: dScore,
            activityScore: aScore,
            totalScore: computeTotalScore(lScore, dScore, aScore),
            topTerms: similarity?.topTerms[e.id] ?? [],
            clusterIndex: clusterMap.get(e.id) ?? -1,
            similarBooks: similarBooksMap.get(e.id) ?? [],
          })
        })
        shelfIndex++
      })

      return result
    },
    staleTime: 1000 * 60 * 5,
  })
}
