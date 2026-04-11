// src/pages/PatternsPage.jsx
import { useState, useEffect } from 'react'
import { useAuth }             from '../hooks/useAuth'
import { loadGames }           from '../services/gamesService'
import { analysePatterns }     from '../services/patternRecognition'
import './PatternsPage.css'

const SEVERITY_CONFIG = {
  high:     { color: '#cc2c2c', bg: 'rgba(204,44,44,0.08)',  border: 'rgba(204,44,44,0.25)',  label: 'Weakness' },
  medium:   { color: '#e07000', bg: 'rgba(224,112,0,0.08)',  border: 'rgba(224,112,0,0.25)',  label: 'Watch out' },
  positive: { color: '#2e7d52', bg: 'rgba(46,125,82,0.08)',  border: 'rgba(46,125,82,0.25)',  label: 'Strength' },
}

function PatternCard({ pattern }) {
  const cfg = SEVERITY_CONFIG[pattern.severity] || SEVERITY_CONFIG.medium
  return (
    <div className="pattern-card" style={{ borderColor: cfg.border, background: cfg.bg }}>
      <div className="pattern-card-header">
        <div className="pattern-title">{pattern.title}</div>
        <div className="pattern-badge" style={{ color: cfg.color, borderColor: cfg.border }}>
          {cfg.label}
        </div>
      </div>

      {pattern.rate !== undefined && (
        <div className="pattern-bar-wrap">
          <div
            className="pattern-bar-fill"
            style={{
              width:      Math.min(pattern.rate * 100, 100) + '%',
              background: cfg.color,
              opacity:    0.7,
            }}
          />
        </div>
      )}

      <p className="pattern-detail">{pattern.detail}</p>

      {pattern.advice && (
        <div className="pattern-advice">
          <span className="pattern-advice-label">Tip</span>
          {pattern.advice}
        </div>
      )}
    </div>
  )
}

export default function PatternsPage() {
  const { user }        = useAuth()
  const [games,      setGames]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [analysing,  setAnalysing]  = useState(false)
  const [progress,   setProgress]   = useState({ current: 0, total: 0 })
  const [result,     setResult]     = useState(null)
  const [error,      setError]      = useState('')
  const [playerColor, setPlayerColor] = useState('w')

  useEffect(() => {
    if (!user) return
    loadGames(user.uid)
      .then(setGames)
      .catch(() => setError('Could not load games.'))
      .finally(() => setLoading(false))
  }, [user])

  const runAnalysis = async () => {
    if (games.length === 0) return
    setAnalysing(true)
    setResult(null)
    setError('')
    setProgress({ current: 0, total: games.length })

    try {
      const res = await analysePatterns(
        games,
        playerColor,
        (current, total) => setProgress({ current, total })
      )
      setResult(res)
    } catch (err) {
      console.error(err)
      setError('Analysis failed. Please try again.')
    } finally {
      setAnalysing(false)
    }
  }

  if (!user) {
    return (
      <div className="page patterns-page">
        <div className="patterns-empty">Sign in to analyse your game patterns.</div>
      </div>
    )
  }

  return (
    <div className="page patterns-page">
      <div className="patterns-header">
        <div>
          <h1 className="page-title">Pattern Analysis</h1>
          <p className="patterns-subtitle">
            Stockfish analyses all your saved games in batch to find recurring mistakes and strengths.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="patterns-loading">
          <div className="spinner" />
        </div>
      ) : games.length === 0 ? (
        <div className="patterns-empty">
          <p>No saved games yet.</p>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 8 }}>
            Save at least 3 games from the Analyze page to get meaningful patterns.
          </p>
        </div>
      ) : (
        <>
          {/* Controls */}
          <div className="patterns-controls card">
            <div className="patterns-controls-row">
              <div>
                <label>Analyse as</label>
                <div className="color-toggle">
                  <button
                    className={`color-btn ${playerColor === 'w' ? 'active' : ''}`}
                    onClick={() => setPlayerColor('w')}
                  >
                    White
                  </button>
                  <button
                    className={`color-btn ${playerColor === 'b' ? 'active' : ''}`}
                    onClick={() => setPlayerColor('b')}
                  >
                    Black
                  </button>
                </div>
              </div>

              <div className="games-summary">
                <span className="games-count">{games.length}</span>
                <span className="text-muted">saved games</span>
              </div>

              <button
                onClick={runAnalysis}
                className="btn btn-primary"
                disabled={analysing}
              >
                {analysing ? 'Analysing...' : 'Run analysis'}
              </button>
            </div>

            {/* Progress bar */}
            {analysing && (
              <div className="analysis-progress">
                <div className="progress-label">
                  Analysing game {progress.current + 1} of {progress.total}...
                  <span className="text-muted" style={{ marginLeft: 8, fontSize: 11 }}>
                    This may take a few minutes
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: progress.total > 0 ? (progress.current / progress.total * 100) + '%' : '0%' }}
                  />
                </div>
              </div>
            )}
          </div>

          {error && <div className="error-banner" style={{ marginTop: 16 }}>{error}</div>}

          {/* Results */}
          {result && (
            <div className="patterns-results">
              <div className="patterns-results-header">
                <div className="results-meta">
                  Analysed <strong>{result.analysedGames}</strong> games ·{' '}
                  <strong>{result.moveCount}</strong> moves as {playerColor === 'w' ? 'White' : 'Black'}
                </div>
              </div>

              {result.patterns.length === 0 ? (
                <div className="patterns-empty">
                  Not enough data to identify patterns yet. Save more games and try again.
                </div>
              ) : (
                <div className="patterns-grid">
                  {result.patterns.map((pattern, i) => (
                    <PatternCard key={i} pattern={pattern} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
