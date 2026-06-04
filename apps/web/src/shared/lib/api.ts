// VITE_API_BASE_URL 미지정 시 빈 문자열 → 상대 경로(/api/...)로 호출 → Vite dev proxy가 처리.
// 프로덕션은 Vercel/배포 환경변수에 `https://your-api.onrender.com` 같은 절대 URL 주입.
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export function apiUrl(path: string): string {
  return API_BASE + path
}
