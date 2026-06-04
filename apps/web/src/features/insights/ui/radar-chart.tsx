import type { CategoryBias } from '../model/compute-bias'

interface Props {
  categories: CategoryBias[]
  size?: number
}

const RING_LEVELS = [0.25, 0.5, 0.75, 1.0]
const ACCENT = '#1E377D'
const LABEL_MAX_CHARS = 9 // 이보다 길면 …로 자르고 hover 시 전체 텍스트

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number): [number, number] {
  return [cx + Math.cos(angleRad) * r, cy + Math.sin(angleRad) * r]
}

function truncate(label: string): string {
  return label.length > LABEL_MAX_CHARS ? label.slice(0, LABEL_MAX_CHARS - 1) + '…' : label
}

export function RadarChart({ categories, size = 280 }: Props) {
  const cx = size / 2
  const cy = size / 2
  const radius = size * 0.36
  const n = categories.length

  if (n < 3) {
    // 레이더는 최소 3축 필요 → 막대 형태 폴백
    const maxRatio = Math.max(...categories.map((c) => c.ratio), 0.0001)
    return (
      <div className="flex flex-col gap-2 px-2 py-3" style={{ width: size, height: size }}>
        {categories.map((c) => (
          <div key={c.category} className="flex items-center gap-2">
            <span className="w-16 truncate text-[11px] text-stone-600">{c.category}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${(c.ratio / maxRatio) * 100}%`, backgroundColor: c.color }}
              />
            </div>
            <span className="w-10 text-right text-[10px] tabular-nums text-stone-400">
              {Math.round(c.ratio * 100)}%
            </span>
          </div>
        ))}
      </div>
    )
  }

  // 각 축 각도 (12시 방향에서 시계 방향)
  const angles = categories.map((_, i) => (i / n) * Math.PI * 2 - Math.PI / 2)

  // 데이터 폴리곤 좌표 (가장 큰 ratio = full radius 가 되도록 정규화)
  const maxRatio = Math.max(...categories.map((c) => c.ratio), 0.0001)
  const dataPoints = categories.map((c, i) => {
    const r = (c.ratio / maxRatio) * radius
    return polarToCartesian(cx, cy, r, angles[i])
  })
  const dataPath = dataPoints.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + ' Z'

  return (
    <svg width={size} height={size} className="block overflow-visible">
      {/* 동심원 그리드 */}
      {RING_LEVELS.map((level) => {
        const pts = angles
          .map((a) => polarToCartesian(cx, cy, radius * level, a))
          .map(([x, y]) => `${x},${y}`)
          .join(' ')
        return (
          <polygon
            key={level}
            points={pts}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={level === 1 ? 1 : 0.6}
          />
        )
      })}

      {/* 축 라인 */}
      {angles.map((a, i) => {
        const [x, y] = polarToCartesian(cx, cy, radius, a)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#E5E7EB" strokeWidth={0.6} />
      })}

      {/* 데이터 영역 */}
      <path d={dataPath} fill={ACCENT} fillOpacity={0.18} stroke={ACCENT} strokeWidth={1.4} />

      {/* 데이터 포인트 */}
      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3.2} fill={categories[i].color} stroke="white" strokeWidth={1} />
      ))}

      {/* 라벨 (축 끝보다 살짝 바깥) */}
      {categories.map((c, i) => {
        const [lx, ly] = polarToCartesian(cx, cy, radius + 16, angles[i])
        const anchor = Math.abs(Math.cos(angles[i])) < 0.2 ? 'middle' : lx > cx ? 'start' : 'end'
        return (
          <g key={c.category}>
            <text
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={10.5}
              fill="#44403C"
              fontWeight={500}
            >
              {truncate(c.category)}
              <title>{c.category}</title>
            </text>
            <text
              x={lx}
              y={ly + 12}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={9}
              fill="#A8A29E"
            >
              {Math.round(c.ratio * 100)}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}
