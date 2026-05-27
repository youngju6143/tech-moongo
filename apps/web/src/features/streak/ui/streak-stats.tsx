interface Props {
  total: number
  monthCount: number
  streak: number
}

export function StreakStats({ total, monthCount, streak }: Props) {
  return (
    <div className="mt-3 flex gap-5 border-t border-stone-100 pt-3">
      <div>
        <p className="text-[10px] text-stone-400">총 포스트</p>
        <p className="text-sm font-bold text-stone-700">{total}편</p>
      </div>
      <div>
        <p className="text-[10px] text-stone-400">이번 달</p>
        <p className="text-sm font-bold text-stone-700">{monthCount}편</p>
      </div>
      <div>
        <p className="text-[10px] text-stone-400">최장 연속</p>
        <p className="text-sm font-bold text-stone-700">{streak}일</p>
      </div>
    </div>
  )
}
