interface Props {
  years: number[]
  activeYear: number
  onSelect: (year: number) => void
}

export function YearTabs({ years, activeYear, onSelect }: Props) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {years.map((year) => (
        <button
          key={year}
          onClick={() => onSelect(year)}
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
            year === activeYear
              ? 'border-sky-500 bg-sky-50 text-sky-700'
              : 'border-stone-200 text-stone-500 hover:border-sky-200 hover:text-sky-600'
          }`}
        >
          {year}
        </button>
      ))}
    </div>
  )
}
