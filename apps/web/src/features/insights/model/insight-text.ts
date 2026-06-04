import { attach } from '@/shared/lib/korean-particle'

import type { BiasSnapshot } from './compute-bias'

export interface InsightLine {
  tone: 'neutral' | 'warn' | 'good'
  text: string
}

export function generateInsights(snapshot: BiasSnapshot, scopeLabel: string): InsightLine[] {
  const { categories, total, topShare, diversity } = snapshot
  if (categories.length === 0 || total === 0) {
    return [{ tone: 'neutral', text: `${scopeLabel} 동안 작성된 글이 없어요.` }]
  }

  const top = categories[0]
  const second = categories[1]
  const lines: InsightLine[] = []
  const topPct = Math.round(topShare * 100)

  lines.push({
    tone: 'neutral',
    text: `${scopeLabel} ${total}개의 글 중 ${attach(top.category, '이/가')} ${topPct}%로 가장 많아요.`,
  })

  // 1) 강한 편중: top이 절반 이상
  if (topShare >= 0.5) {
    lines.push({
      tone: 'warn',
      text: `${top.category} 한 분야에 크게 편중되어 있어요. 다른 영역도 시도해 보면 어떨까요?`,
    })
    return lines
  }

  // 2) 진짜 균등: top이 30% 이하 + 엔트로피 거의 최대
  if (topShare <= 0.3 && diversity >= 0.9) {
    lines.push({
      tone: 'good',
      text: '여러 분야에 고르게 학습하고 계시네요.',
    })
    return lines
  }

  // 3) 약한 편중: top이 두드러지는 정도 — 2위와 격차 표시
  if (second && topShare - second.ratio >= 0.15) {
    const secondPct = Math.round(second.ratio * 100)
    const gapPct = Math.round((topShare - second.ratio) * 100)
    lines.push({
      tone: 'neutral',
      text: `${attach(top.category, '이/가')} ${second.category}(${secondPct}%)보다 ${gapPct}%p 더 많아요.`,
    })
    return lines
  }

  // 4) 그 외: top과 second가 비등 → 양강 구도
  if (second) {
    const secondPct = Math.round(second.ratio * 100)
    lines.push({
      tone: 'neutral',
      text: `${attach(top.category, '와/과')} ${attach(second.category, '을/를')} 비슷한 비중으로 다루고 있어요. (각 ${topPct}%, ${secondPct}%)`,
    })
  }

  return lines
}
