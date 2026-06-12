import { create } from 'zustand'

import type { ThemeName } from '../config/constants'

// 히트맵 패널 설정 전역 상태 (테마·선택 연도)
// 패널이 닫혔다 열려도, 다른 컴포넌트에서 참조해도 설정이 유지된다.
interface StreakSettingsState {
  theme: ThemeName
  selectedYear: number | null
  setTheme: (theme: ThemeName) => void
  setSelectedYear: (year: number | null) => void
}

export const useStreakSettings = create<StreakSettingsState>((set) => ({
  theme: '블루',
  selectedYear: null,
  setTheme: (theme) => set({ theme }),
  setSelectedYear: (selectedYear) => set({ selectedYear }),
}))
