// ── Helpers ───────────────────────────────────────────────────────────────────
function minMaxNormalize(values: number[]): number[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) return values.map(() => 0.5)
  return values.map((v) => (v - min) / (max - min))
}

// ── (1) LengthScore — Min-Max normalization of raw char counts ────────────────
// data_analysis.md §2-(1): LengthScore = (Length - min) / (max - min)
export function computeLengthScores(contentLengths: number[]): number[] {
  return minMaxNormalize(contentLengths)
}

// ── (2) DepthScore — code block weight + keyword weight, then normalized ──────
// 설문(n=49) 기반 재조정: DepthScore = CodeCount×0.4 + KeywordCount×0.6
// (대응표본 t-검정 t(48)=-4.000, p<.0001 — 키워드 중요도가 유의하게 높음)
export function computeDepthScores(
  books: Array<{ codeBlockCount: number; keywordCount: number; contentLength: number }>
): number[] {
  const rawScores = books.map((b) => b.codeBlockCount * 0.4 + b.keywordCount * 0.6)
  const min = Math.min(...rawScores)
  const max = Math.max(...rawScores)
  if (max === min) {
    // Fallback to content length when depth signals are flat (e.g., missing block data).
    return minMaxNormalize(books.map((b) => b.contentLength))
  }
  return rawScores.map((v) => (v - min) / (max - min))
}

// ── (3) ActivityScore — time decay recency + streak bonus ────────────────────
// data_analysis.md §2-(3): ActivityScore = Recency + StreakBonus
const DECAY_RATE = 0.003 // e^(-0.003*days) → ~0.5 at 231 days

function recency(dateStr: string): number {
  const daysSince = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  return Math.exp(-DECAY_RATE * Math.max(daysSince, 0))
}

// Posts written within STREAK_WINDOW days of each other belong to one streak.
const STREAK_WINDOW_DAYS = 14

function buildStreakMap(dates: string[]): Map<string, number> {
  const sorted = [...dates].sort()
  const streakMap = new Map<string, number>()

  let streakStart = 0
  for (let i = 1; i <= sorted.length; i++) {
    const isEnd = i === sorted.length
    const gap = !isEnd
      ? (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity
    if (isEnd || gap > STREAK_WINDOW_DAYS) {
      const length = i - streakStart
      for (let j = streakStart; j < i; j++) streakMap.set(sorted[j], length)
      streakStart = i
    }
  }
  return streakMap
}

export function computeActivityScores(books: Array<{ date: string }>): number[] {
  const dates = books.map((b) => b.date)
  const streakMap = buildStreakMap(dates)
  const maxStreak = Math.max(...streakMap.values(), 1)

  const rawScores = books.map((b) => {
    const rec = recency(b.date)
    const streak = (streakMap.get(b.date) ?? 1) / maxStreak
    return rec + streak
  })
  return minMaxNormalize(rawScores)
}

// ── (4) OriginalityScore — block type distribution as authenticity proxy ─────
// 설문 자유 응답 주제별 빈도 기반 가중치:
//   Originality = 0.4·Image + 0.3·(Callout+Toggle) + 0.3·(Quote+Bookmark)
export function computeOriginalityScores(
  books: Array<{
    imageCount: number
    calloutCount: number
    toggleCount: number
    quoteCount: number
    bookmarkCount: number
  }>
): number[] {
  const rawScores = books.map(
    (b) =>
      b.imageCount * 0.4 +
      (b.calloutCount + b.toggleCount) * 0.3 +
      (b.quoteCount + b.bookmarkCount) * 0.3
  )
  return minMaxNormalize(rawScores)
}

// ── Total Score ───────────────────────────────────────────────────────────────
// TotalScore = Length×0.3 + Depth×0.3 + Activity×0.2 + Originality×0.2
export function computeTotalScore(
  lengthScore: number,
  depthScore: number,
  activityScore: number,
  originalityScore: number
): number {
  return lengthScore * 0.3 + depthScore * 0.3 + activityScore * 0.2 + originalityScore * 0.2
}

// ── Design mapping helpers ────────────────────────────────────────────────────
// data_analysis.md §4: 질감/스타일 ← DepthScore (높을수록 복잡한 패턴)
export function depthToPattern(depthScore: number): 'plain' | 'bordered' | 'striped' | 'embossed' {
  if (depthScore < 0.25) return 'plain'
  if (depthScore < 0.5) return 'bordered'
  if (depthScore < 0.75) return 'striped'
  return 'embossed'
}

// data_analysis.md §4: 두께 ← LengthScore (0.08–0.22 world units)
export function lengthToThickness(lengthScore: number): number {
  return 0.08 + lengthScore * 0.14
}

// 표면 거칠기 ← OriginalityScore (roughness 0.1–0.9, 높을수록 거친 엠보싱 질감)
export function originalityToRoughness(originalityScore: number): number {
  return 0.1 + originalityScore * 0.8
}
