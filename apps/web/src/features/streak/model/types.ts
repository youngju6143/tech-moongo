export interface DayCell {
  date: string
  count: number
  future: boolean
}

export interface WeekCol {
  cells: DayCell[]
  monthLabel: string | null
}

export interface YearSection {
  year: number
  weeks: WeekCol[]
}
