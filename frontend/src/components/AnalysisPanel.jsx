// src/components/AnalysisPanel.jsx
import { Chess } from 'chess.js'
import './AnalysisPanel.css'

// Convert centipawn score to a visual eval bar value (-1 to +1)
function cpToBar(score) {
  if (!score) return 0
  if (score.type === 'mate') return score.value > 0 ? 1 : -1
  return Math.tanh(score.value / 400)
}

// Format score for display
function formatScore(score) {
  if (!score) return '0.00'
  if (score.type === 'mate') return `M${Math.abs(score.value)}`
  const cp = score.value / 100
  return (cp >= 0 ? '+' : '') + cp.toFixed(2)
}

// Convert UCI move (e.g. "e2e4") to SAN using chess.js
function uciToSan(fen, uciMove) {
  try {
    const chess = new Chess(fen)
    const move = chess.move({
      from: uciMove.slice(0, 2),
      to:   uciMove.slice(2, 4),
      promotion: uciMove[4] || 'q',
    })
    return move?.san || uciMove
  } catch {
    return uciMove
  }
}

export default function AnalysisPanel({ fen, score, bestMove, lines, depth, isThinking, ready }) {
  const barValue = cpToBar(score)
  const whiteWinning = barValue >= 0

  return (
    <div className="analysis-panel card">
      <div className="panel-header">
        <h2 className="card-title">Engine Analysis</h2>
        <div className={`engine-status ${ready ? (isThinking ? 'thinking' : 'ready') : 'loading'}`}>
          {!ready && 'Loading…'}
          {ready && isThinking && <><span className="pulse-dot"/> Thinking…</>}
          {ready && !isThinking && 'Ready'}
        </div>
      </div>

      {/* Eval bar */}
      <div className="eval-row">
        <div className="eval-bar-wrap">
          <div
            className="eval-bar-fill"
            style={{ height: `${((barValue + 1) / 2) * 100}%` }}
          />
        </div>
        <div className={`eval-score ${whiteWinning ? 'text-1' : 'text-muted'}`}>
          {formatScore(score)}
          <span className="eval-depth">depth {depth}</span>
        </div>
      </div>

      {/* Best move */}
      {bestMove && (
        <div className="best-move-wrap">
          <span className="best-move-label">Best move</span>
          <span className="best-move-san">
            {uciToSan(fen, bestMove)}
          </span>
          <span className="best-move-uci text-muted">({bestMove})</span>
        </div>
      )}

      {/* Top 3 lines */}
      {lines.length > 0 && (
        <div className="lines-section">
          <p className="lines-header">Top lines</p>
          {lines.map((line, i) => (
            <div key={i} className="pv-line">
              <span className="pv-rank">{i + 1}</span>
              <span className="pv-moves">
                {line.slice(0, 5).map((uci) => uciToSan(fen, uci)).join(' ')}
                {line.length > 5 && ' …'}
              </span>
            </div>
          ))}
        </div>
      )}

      {!ready && (
        <p className="text-muted" style={{ fontSize: 12, marginTop: 12 }}>
          Loading Stockfish engine…
        </p>
      )}
    </div>
  )
}
