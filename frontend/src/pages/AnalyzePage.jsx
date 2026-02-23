// src/pages/AnalyzePage.jsx
import { useState, useCallback } from 'react'
import { Chessboard }    from 'react-chessboard'
import { Chess }         from 'chess.js'
import { useStockfish }  from '../hooks/useStockfish'
import { useAuth }       from '../hooks/useAuth'
import ImageUpload       from '../components/ImageUpload'
import AnalysisPanel     from '../components/AnalysisPanel'
import SaveGameModal     from '../components/SaveGameModal'
import { saveGame }      from '../services/gamesService'
import './AnalyzePage.css'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export default function AnalyzePage() {
  const { user }         = useAuth()
  const sf               = useStockfish()
  const [chess]          = useState(() => new Chess())
  const [fen,  setFen]   = useState(START_FEN)
  const [inputMode, setInputMode] = useState('board')  // 'board' | 'image' | 'fen'
  const [fenInput, setFenInput]   = useState('')
  const [errorMsg, setErrorMsg]   = useState('')
  const [saveModal, setSaveModal] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [boardOrientation, setBoardOrientation] = useState('white')
  const [moveHistory, setMoveHistory]  = useState([])

  // ── Update position + trigger analysis ───────────────────────
  const loadFen = useCallback((newFen) => {
    try {
      chess.load(newFen)
      setFen(newFen)
      setErrorMsg('')
      setMoveHistory([])
      sf.analyse(newFen)
    } catch {
      setErrorMsg('Invalid FEN string.')
    }
  }, [chess, sf])

  // ── Board move handler ────────────────────────────────────────
  const onDrop = (sourceSquare, targetSquare) => {
    try {
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      })
      if (!move) return false
      const newFen = chess.fen()
      setFen(newFen)
      setMoveHistory(chess.history({ verbose: true }))
      sf.analyse(newFen)
      return true
    } catch {
      return false
    }
  }

  // ── Image recognition callback ────────────────────────────────
  const onFenReceived = (fen) => {
    loadFen(fen)
    setInputMode('board')
  }

  // ── FEN input submit ──────────────────────────────────────────
  const onFenSubmit = () => {
    if (fenInput.trim()) loadFen(fenInput.trim())
  }

  // ── Reset ─────────────────────────────────────────────────────
  const reset = () => {
    chess.reset()
    setFen(START_FEN)
    setFenInput('')
    setErrorMsg('')
    setMoveHistory([])
    sf.analyse(START_FEN)
  }

  // ── Save game ─────────────────────────────────────────────────
  const handleSave = async ({ title, notes }) => {
    try {
      setSaveStatus('saving')
      await saveGame(user.uid, {
        title,
        notes,
        fen,
        pgn: chess.pgn(),
        moves: chess.history(),
      })
      setSaveStatus('saved')
      setSaveModal(false)
      setTimeout(() => setSaveStatus(''), 2000)
    } catch (e) {
      setSaveStatus('error')
    }
  }

  return (
    <div className="analyze-page page">
      <div className="analyze-header">
        <h1 className="page-title">Analyze Position</h1>
        <div className="header-actions">
          {saveStatus === 'saved' && <span className="text-green">✓ Saved!</span>}
          <button onClick={() => setSaveModal(true)} className="btn btn-ghost">
            Save Game
          </button>
          <button onClick={reset} className="btn btn-ghost">
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Input mode tabs */}
      <div className="mode-tabs">
        {[
          { key: 'board', label: 'Interactive Board' },
          { key: 'image', label: 'Upload Photo' },
          { key: 'fen',   label: 'FEN String' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setInputMode(key)}
            className={`mode-tab ${inputMode === key ? 'active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div className="error-banner">{errorMsg}</div>
      )}

      <div className="analyze-grid">
        {/* Left: board + input controls */}
        <div className="board-column">
          {/* The board is always visible */}
          <div className="board-wrap">
            <Chessboard
              position={fen}
              onPieceDrop={onDrop}
              boardOrientation={boardOrientation}
              customBoardStyle={{ borderRadius: '8px', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
              customDarkSquareStyle={{ backgroundColor: '#b58863' }}
              customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
            />
          </div>

          {/* Board controls */}
          <div className="board-controls">
            <button
              className="btn btn-ghost"
              onClick={() => setBoardOrientation(o => o === 'white' ? 'black' : 'white')}
            >
              ⟳ Flip board
            </button>
            <span className="fen-display" title={fen}>{fen.split(' ')[0]}</span>
          </div>

          {/* Image upload mode */}
          {inputMode === 'image' && (
            <div className="card mt-16">
              <p className="card-title">Upload Board Photo</p>
              <p className="text-muted" style={{ fontSize: 12, marginBottom: 12 }}>
                Take a clear photo from directly above the board. Ensure all pieces are visible.
              </p>
              <ImageUpload onFenReceived={onFenReceived} onError={setErrorMsg} />
            </div>
          )}

          {/* FEN input mode */}
          {inputMode === 'fen' && (
            <div className="card mt-16">
              <label>Paste FEN string</label>
              <div className="fen-input-row">
                <input
                  value={fenInput}
                  onChange={(e) => setFenInput(e.target.value)}
                  placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                  onKeyDown={(e) => e.key === 'Enter' && onFenSubmit()}
                />
                <button onClick={onFenSubmit} className="btn btn-primary">Load</button>
              </div>
            </div>
          )}
        </div>

        {/* Right: analysis + move history */}
        <div className="analysis-column">
          <AnalysisPanel
            fen={fen}
            score={sf.score}
            bestMove={sf.bestMove}
            lines={sf.lines}
            depth={sf.depth}
            isThinking={sf.isThinking}
            ready={sf.ready}
          />

          {/* Move history */}
          {moveHistory.length > 0 && (
            <div className="card mt-16">
              <p className="card-title">Move History</p>
              <div className="move-history">
                {moveHistory.reduce((acc, move, i) => {
                  if (i % 2 === 0) {
                    acc.push({ num: Math.floor(i / 2) + 1, white: move.san, black: null })
                  } else {
                    acc[acc.length - 1].black = move.san
                  }
                  return acc
                }, []).map(({ num, white, black }) => (
                  <div key={num} className="move-row">
                    <span className="move-num">{num}.</span>
                    <span className="move-san">{white}</span>
                    {black && <span className="move-san">{black}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {saveModal && (
        <SaveGameModal
          onSave={handleSave}
          onClose={() => setSaveModal(false)}
          isSaving={saveStatus === 'saving'}
        />
      )}
    </div>
  )
}
