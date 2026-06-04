import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'

import type { VisualBook } from '@/features/bookshelf/model/use-bookshelf-books'

import { computeBias, filterRecent, type BiasMetric } from './model/compute-bias'
import { generateInsights } from './model/insight-text'
import { RadarChart } from './ui/radar-chart'

type Scope = 'all' | 'recent'

const SCOPE_LABEL: Record<Scope, string> = {
  all: '전체 기간',
  recent: '최근 3개월',
}

const METRIC_LABEL: Record<BiasMetric, string> = {
  count: '글 수 기준',
  length: '분량 기준',
}

const TONE_CLASS = {
  neutral: 'text-stone-600',
  warn: 'text-amber-600',
  good: 'text-emerald-600',
} as const

export function InsightPanel({ books }: { books: VisualBook[] }) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<Scope>('all')
  const [metric, setMetric] = useState<BiasMetric>('count')

  const snapshot = useMemo(() => {
    const scoped = scope === 'all' ? books : filterRecent(books)
    return computeBias(scoped, metric)
  }, [books, scope, metric])

  const insights = useMemo(
    () => generateInsights(snapshot, SCOPE_LABEL[scope]),
    [snapshot, scope],
  )

  if (books.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-40 select-none">
      <div className="w-96 rounded-2xl border border-stone-200/60 bg-white/92 shadow-2xl backdrop-blur-md">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-6 px-4 py-3 text-left"
        >
          <span className="text-sm font-semibold text-stone-700">학습 편향 분석</span>
          <span className="text-[10px] text-stone-400">{open ? '▲' : '▼'}</span>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: 0.32, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="border-t border-stone-100 px-4 pt-3 pb-4">
                <div className="mb-3 flex flex-wrap gap-1">
                  <SegmentedGroup
                    options={[
                      { value: 'all', label: '전체' },
                      { value: 'recent', label: '최근 3개월' },
                    ]}
                    value={scope}
                    onChange={setScope}
                  />
                  <SegmentedGroup
                    options={[
                      { value: 'count', label: '글 수' },
                      { value: 'length', label: '분량' },
                    ]}
                    value={metric}
                    onChange={setMetric}
                  />
                </div>

                <div className="flex justify-center">
                  <RadarChart categories={snapshot.categories} size={280} />
                </div>

                <div className="mt-3 space-y-1.5 border-t border-stone-100 pt-3">
                  {insights.map((line, i) => (
                    <p key={i} className={`text-[12px] leading-snug ${TONE_CLASS[line.tone]}`}>
                      {line.text}
                    </p>
                  ))}
                </div>

                <p className="mt-3 text-[10px] text-stone-400">
                  {SCOPE_LABEL[scope]} · {METRIC_LABEL[metric]} · 카테고리 {snapshot.categories.length}개
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

interface SegmentedGroupProps<T extends string> {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}

function SegmentedGroup<T extends string>({ options, value, onChange }: SegmentedGroupProps<T>) {
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-stone-200">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={
              'px-2.5 py-1 text-[10.5px] font-medium transition-colors ' +
              (active ? 'bg-stone-800 text-white' : 'bg-white text-stone-500 hover:bg-stone-50')
            }
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
