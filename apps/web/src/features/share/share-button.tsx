import { useState } from 'react'

interface Props {
  dbId: string
}

export function ShareButton({ dbId }: Props) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    if (!dbId) return
    const url = `${window.location.origin}/share/${dbId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('공유 URL', url)
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={!dbId}
      className="fixed top-4 left-4 z-40 flex items-center gap-1.5 rounded-full border border-stone-200/60 bg-white/92 px-3.5 py-2 text-xs font-medium text-stone-700 shadow-lg backdrop-blur-md transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      <ShareIcon />
      {copied ? '복사 완료!' : '내 서재 공유'}
    </button>
  )
}

export function SharedBadge() {
  return (
    <div className="fixed top-4 left-4 z-40 flex items-center gap-1.5 rounded-full border border-stone-200/60 bg-white/92 px-3.5 py-2 text-xs font-medium text-stone-500 shadow-lg backdrop-blur-md">
      <EyeIcon />
      공유된 서재 (읽기 전용)
    </div>
  )
}

function ShareIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
