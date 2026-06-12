export interface TooltipInfo {
  title: string
  thumbnail: string | null
  date: string
  category: string
  categoryColor: string
  totalScore: number
  topTerms: string[]
  similarBooks: Array<{ title: string; score: number }>
}

export interface TooltipState {
  info: TooltipInfo
  x: number
  y: number
}

const TOOLTIP_W = 224
const TOOLTIP_MAX_H = 340

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${y}년 ${Number(m)}월 ${Number(d)}일`
}

export function BookTooltip({ tooltip }: { tooltip: TooltipState }) {
  const { info, x, y } = tooltip
  const safeX = x + 20 + TOOLTIP_W > window.innerWidth ? x - TOOLTIP_W - 12 : x + 16
  const safeY = Math.min(y - 12, window.innerHeight - TOOLTIP_MAX_H - 8)

  return (
    <div
      style={{ left: safeX, top: safeY }}
      className="pointer-events-none fixed z-50 w-56 overflow-hidden rounded-2xl border border-stone-200/60 bg-white/95 shadow-2xl backdrop-blur-md"
    >
      {info.thumbnail ? (
        <img src={info.thumbnail} alt="" className="h-32 w-full object-cover" />
      ) : (
        <div className="flex h-20 w-full items-center justify-center bg-stone-100">
          <span className="text-3xl">📚</span>
        </div>
      )}
      <div className="px-3 py-2.5">
        <p className="text-sm leading-snug font-semibold text-stone-800">{info.title}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-xs text-stone-400">{formatDate(info.date)}</p>
          {info.category && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: info.categoryColor }}
            >
              {info.category}
            </span>
          )}
        </div>
        <p className="mt-1 text-[11px] text-stone-500">
          종합 점수 <span className="font-semibold tabular-nums">{Math.round(info.totalScore * 100)}</span>점
        </p>

        {info.topTerms.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {info.topTerms.map((term) => (
              <span
                key={term}
                className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-500"
              >
                {term}
              </span>
            ))}
          </div>
        )}

        {info.similarBooks.length > 0 && (
          <div className="mt-2.5 border-t border-stone-100 pt-2">
            <p className="mb-1 text-[10px] font-medium text-stone-400">비슷한 글</p>
            <ul className="space-y-1">
              {info.similarBooks.map(({ title, score }) => (
                <li key={title} className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] text-stone-600">{title}</span>
                  <span className="shrink-0 text-[10px] tabular-nums text-stone-400">
                    {Math.round(score * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
