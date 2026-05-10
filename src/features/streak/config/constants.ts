export const CELL = 11
export const GAP = 2
export const STEP = CELL + GAP
export const EMPTY_CELL_COLOR = '#e5e7eb'

export const THEMES = {
  앰버: ['#ece7de', '#d4a96a', '#b8864e', '#9c6b3c', '#6b3f1e'],
  그린: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  블루: ['#ebedf0', '#9ecff4', '#58a6ff', '#1f6feb', '#0d419d'],
  퍼플: ['#f0edf8', '#c4b5f4', '#a78bfa', '#7c3aed', '#4c1d95'],
  로즈: ['#fce7f3', '#fbcfe8', '#f472b6', '#db2777', '#9d174d'],
} as const

export type ThemeName = keyof typeof THEMES

export function cellColor(count: number, theme: ThemeName): string {
  const s = THEMES[theme]
  if (count === 0) return s[0]
  if (count === 1) return s[1]
  if (count === 2) return s[2]
  if (count === 3) return s[3]
  return s[4]
}
