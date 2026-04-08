// src/components/EvalGraph.jsx
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import './EvalGraph.css'

const QUALITY_COLORS = {
  'Best':       '#5c8a3c',
  'Good':       '#a0a0a0',
  'Inaccuracy': '#f0a500',
  'Mistake':    '#e07000',
  'Blunder':    '#cc2c2c',
}

function clampCp(cp) {
  return Math.max(-800, Math.min(800, cp))
}

function formatEval(cp) {
  if (cp >= 800)  return '+M'
  if (cp <= -800) return '-M'
  const val = (cp / 100).toFixed(1)
  return cp > 0 ? '+' + val : val
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="eval-tooltip">
      <div className="eval-tooltip-move">{d.san || '—'}</div>
      <div className="eval-tooltip-score" style={{ color: d.cp >= 0 ? '#f5f0e8' : '#cc8888' }}>
        {formatEval(d.cp)}
      </div>
      {d.quality && (
        <div className="eval-tooltip-quality" style={{ color: QUALITY_COLORS[d.quality.label] }}>
          {d.quality.emoji} {d.quality.label}
        </div>
      )}
    </div>
  )
}

function CustomDot({ cx, cy, payload }) {
  if (!payload?.quality || payload.quality.label === 'Good' || payload.quality.label === 'Best') {
    return null
  }
  const color = QUALITY_COLORS[payload.quality.label] || '#a0a0a0'
  return (
    <circle
      cx={cx} cy={cy} r={5}
      fill={color} stroke="#1a1612" strokeWidth={1.5}
    />
  )
}

export default function EvalGraph({ evalHistory, onMoveClick, currentMoveIdx }) {
  if (!evalHistory || evalHistory.length === 0) {
    return (
      <div className="eval-graph-empty">
        Play moves to see the evaluation graph
      </div>
    )
  }

  const data = evalHistory.map((entry, i) => ({
    ...entry,
    cp:    clampCp(entry.cp),
    index: i,
  }))

  return (
    <div className="eval-graph-wrap">
      <div className="eval-graph-labels">
        <span>White</span>
        <span>Black</span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
          onClick={(e) => {
            if (e?.activePayload?.[0] && onMoveClick) {
              onMoveClick(e.activePayload[0].payload.index)
            }
          }}
        >
          <defs>
            <linearGradient id="evalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f5f0e8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#1a1612" stopOpacity={0.1} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
            vertical={false}
          />

          <XAxis
            dataKey="index"
            tick={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
          />

          <YAxis
            domain={[-800, 800]}
            tickCount={5}
            tickFormatter={formatEval}
            tick={{ fill: 'var(--text-3)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip content={<CustomTooltip />} />

          <ReferenceLine
            y={0}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={1}
          />

          <Area
            type="monotone"
            dataKey="cp"
            stroke="var(--red)"
            strokeWidth={2}
            fill="url(#evalGradient)"
            dot={<CustomDot />}
            activeDot={{
              r: 6,
              fill: 'var(--red)',
              stroke: '#1a1612',
              strokeWidth: 2,
              cursor: 'pointer',
            }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Move quality summary */}
      <div className="eval-summary">
        {Object.entries(QUALITY_COLORS).map(([label, color]) => {
          const count = evalHistory.filter(e => e.quality?.label === label).length
          if (count === 0) return null
          return (
            <div key={label} className="eval-summary-item">
              <span className="eval-summary-dot" style={{ background: color }} />
              <span className="eval-summary-count">{count}</span>
              <span className="eval-summary-label">{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
