// src/pages/AnalyzePage.jsx
import { useState, useCallback, useEffect } from 'react'
import { useSearchParams }  from 'react-router-dom'
import { Chessboard }       from 'react-chessboard'
import { Chess }            from 'chess.js'
import { useStockfish }     from '../hooks/useStockfish'
import { useOpening }       from '../hooks/useOpening'
import { useAuth }          from '../hooks/useAuth'
import ImageUpload          from '../components/ImageUpload'
import AnalysisPanel        from '../components/AnalysisPanel'
import SaveGameModal        from '../components/SaveGameModal'
import PgnImportModal       from '../components/PgnImportModal'
import EvalGraph            from '../components/EvalGraph'
import { saveGame }         from '../services/gamesService'
import './AnalyzePage.css'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export default function AnalyzePage() {
  const { user }         = useAuth()
  const sf               = useStockfish()
  const [searchParams, setSearchParams] = useSearchParams()
  const [chess]          = useState(() => new Chess())
  const [fen,  setFen]   = useState(START_FEN)
  const [inputMode, setInputMode]   = useState('board')
  const [fenInput,  setFenInput]    = useState('')
  const [errorMsg,  setErrorMsg]    = useState('')
  const [saveModal, setSaveModal]   = useState(false)
  const [saveStatus,setSaveStatus]  = useState('')
  const [copied,    setCopied]      = useState(false)
  const [pgnModal,  setPgnModal]    = useState(false)
  const [boardOrientation, setBoardOrientation] = useState('white')
  const [moveHistory, setMoveHistory] = useState([])
  const [selectedSquare,   setSelectedSquare]   = useState(null)
  const [highlightSquares, setHighlightSquares] = useState({})

  // Tree-based branching
  const [treeNodes,   setTreeNodes]   = useState([])
  const [currentNode, setCurrentNode] = useState(-1)

  // Opening detection
  const opening = useOpening(moveHistory)

  // Responsive board
  const [boardWidth, setBoardWidth] = useState(
    Math.min(window.innerWidth - 32, 520)
  )
  useEffect(() => {
    const onResize = () => setBoardWidth(Math.min(window.innerWidth - 32, 520))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Load FEN (defined early so the URL effect can call it) ──
  const loadFen = useCallback((newFen) => {
    try {
      chess.load(newFen)
      setFen(newFen); setErrorMsg('')
      setMoveHistory([]); setTreeNodes([]); setCurrentNode(-1)
      sf.resetEvalHistory()
      sf.analyse(newFen)
    } catch {
      setErrorMsg('Invalid FEN string.')
    }
  }, [chess, sf])

  // ── Load FEN from URL on first render ──────────────────────
  useEffect(() => {
    const fenFromUrl = searchParams.get('fen')
    if (fenFromUrl) {
      loadFen(decodeURIComponent(fenFromUrl))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Share position ────────────────────────────────────────
  const sharePosition = useCallback(() => {
    const url = `${window.location.origin}/analyze?fen=${encodeURIComponent(fen)}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
    setSearchParams({ fen })
  }, [fen, setSearchParams])

  // ── Navigation ────────────────────────────────────────────
  const navigateTo = useCallback((nodeIdx, nodes) => {
    const nodeList = nodes || treeNodes
    if (nodeIdx < 0) {
      chess.reset()
      const f = chess.fen()
      setFen(f); setCurrentNode(-1); setMoveHistory([])
      sf.analyse(f)
      return
    }
    const node = nodeList[nodeIdx]
    if (!node) return
    chess.load(node.fen)
    setFen(node.fen)
    setCurrentNode(nodeIdx)
    setMoveHistory(chess.history({ verbose: true }))
    sf.analyse(node.fen)
  }, [treeNodes, chess, sf])

  const goBack    = useCallback(() => {
    if (currentNode < 0) return
    navigateTo(treeNodes[currentNode]?.parentIdx ?? -1)
  }, [currentNode, treeNodes, navigateTo])

  const goForward = useCallback(() => {
    const idx = treeNodes.findIndex(n => n.parentIdx === currentNode)
    if (idx < 0) return
    navigateTo(idx)
  }, [currentNode, treeNodes, navigateTo])

  const goToStart = useCallback(() => navigateTo(-1), [navigateTo])

  const goToEnd   = useCallback(() => {
    let idx = currentNode
    while (true) {
      const next = treeNodes.findIndex(n => n.parentIdx === idx)
      if (next < 0) break
      idx = next
    }
    if (idx !== currentNode) navigateTo(idx)
  }, [currentNode, treeNodes, navigateTo])

  // ── Keyboard nav ──────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowRight') { e.preventDefault(); goForward() }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goBack() }
      if (e.key === 'ArrowUp')    { e.preventDefault(); goToStart() }
      if (e.key === 'ArrowDown')  { e.preventDefault(); goToEnd() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goForward, goBack, goToStart, goToEnd])

  // ── Move helpers ──────────────────────────────────────────
  const makeMove = useCallback((from, to) => {
    setSelectedSquare(null)
    setHighlightSquares({})
    try {
      const move = chess.move({ from, to, promotion: 'q' })
      if (!move) return false

      const newFen  = chess.fen()
      const isWhite = move.color === 'w'

      const existing = treeNodes.findIndex(
        n => n.parentIdx === currentNode && n.san === move.san
      )

      if (existing >= 0) {
        setCurrentNode(existing)
      } else {
        const newNode = { fen: newFen, san: move.san, uci: from + to, parentIdx: currentNode }
        setTreeNodes(prev => {
          const next = [...prev, newNode]
          setCurrentNode(next.length - 1)
          return next
        })
      }

      setFen(newFen)
      setMoveHistory(chess.history({ verbose: true }))
      sf.recordMove(move.san, isWhite, sf.score)
      sf.analyse(newFen)
      return true
    } catch {
      return false
    }
  }, [chess, currentNode, treeNodes, sf])

  // ── Square click (move highlighting) ─────────────────────
  const onSquareClick = useCallback((square) => {
    if (selectedSquare) {
      const moved = makeMove(selectedSquare, square)
      if (moved) return
    }

    const moves = chess.moves({ square, verbose: true })
    if (moves.length === 0) {
      setSelectedSquare(null); setHighlightSquares({})
      return
    }

    setSelectedSquare(square)
    const highlights = { [square]: { background: 'rgba(192,57,43,0.4)' } }
    moves.forEach(m => {
      highlights[m.to] = {
        background: chess.get(m.to)
          ? 'radial-gradient(circle, rgba(192,57,43,0.5) 60%, transparent 65%)'
          : 'radial-gradient(circle, rgba(192,57,43,0.35) 25%, transparent 30%)',
        borderRadius: '50%',
      }
    })
    setHighlightSquares(highlights)
  }, [selectedSquare, chess, makeMove])

  const onDrop = (sourceSquare, targetSquare) => makeMove(sourceSquare, targetSquare)

  const onFenReceived = (f) => { loadFen(f); setInputMode('board') }
  const onFenSubmit   = () => { if (fenInput.trim()) loadFen(fenInput.trim()) }

  // ── Reset ─────────────────────────────────────────────────
  const reset = () => {
    chess.reset()
    setFen(START_FEN); setFenInput(''); setErrorMsg('')
    setMoveHistory([]); setTreeNodes([]); setCurrentNode(-1)
    setSelectedSquare(null); setHighlightSquares({})
    sf.resetEvalHistory()
    setSearchParams({})
    sf.analyse(START_FEN)
  }

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async ({ title, white, black, notes }) => {
    if (!user) {
      setSaveStatus('error')
      setErrorMsg('You must be signed in to save games.')
      return
    }
    try {
      setSaveStatus('saving')
      await saveGame(user.uid, {
        title, white, black, notes, fen,
        pgn:   chess.pgn(),
        moves: chess.history(),
      })
      setSaveStatus('saved')
      setSaveModal(false)
      setTimeout(() => setSaveStatus(''), 2000)
    } catch (err) {
      console.error('Save failed:', err)
      setSaveStatus('error')
      setErrorMsg('Save failed: ' + (err?.message || 'unknown error'))
    }
  }

  // ── PGN Import ────────────────────────────────────────────
  const handlePgnImport = ({ pgn, lastFen, history }) => {
    try {
      chess.loadPgn(pgn)
      const nodes = []
      const tempChess = new Chess()
      history.forEach((san, i) => {
        tempChess.move(san)
        nodes.push({ fen: tempChess.fen(), san, uci: san, parentIdx: i - 1 })
      })
      setTreeNodes(nodes)
      setCurrentNode(nodes.length - 1)
      chess.loadPgn(pgn)
      setFen(lastFen)
      setMoveHistory(chess.history({ verbose: true }))
      sf.resetEvalHistory()
      sf.analyse(lastFen)
      setSearchParams({ fen: lastFen })
    } catch {
      console.error("PGN import failed")
    }
  }

  const onGraphMoveClick = (idx) => {
    if (idx < treeNodes.length) navigateTo(idx)
  }

  return (
    <div className="analyze-page page">

      {/* Header */}
      <div className="analyze-header">
        <div>
          <h1 className="page-title">Analyze Position</h1>
          {opening && (
            <div className="opening-badge">
              <span className="opening-eco">{opening.eco}</span>
              {opening.name}
            </div>
          )}
        </div>
        <div className="header-actions">
          {saveStatus === 'saved' && <span className="text-green">Saved!</span>}
          <button onClick={sharePosition} className="btn btn-ghost">
            {copied ? 'Copied!' : 'Share'}
          </button>
          <button onClick={() => setSaveModal(true)} className="btn btn-ghost">Save Game</button>
          <button onClick={reset} className="btn btn-ghost">Reset</button>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="mode-tabs">
        {[
          { key: 'board', label: 'Interactive Board' },
          { key: 'image', label: 'Upload Photo' },
          { key: 'fen',   label: 'FEN String' },
          { key: 'pgn',   label: 'Import PGN' },
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

      {errorMsg && <div className="error-banner">{errorMsg}</div>}

      <div className="analyze-grid">

        {/* Left column */}
        <div className="board-column">
          <div className="board-wrap">
            <Chessboard
              position={fen}
              onPieceDrop={onDrop}
              onSquareClick={onSquareClick}
              boardWidth={boardWidth}
              boardOrientation={boardOrientation}
              customSquareStyles={highlightSquares}
              customBoardStyle={{ borderRadius: '8px', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}
              customDarkSquareStyle={{ backgroundColor: '#b58863' }}
              customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
            />
          </div>

          <div className="board-controls">
            <button
              className="btn btn-ghost"
              onClick={() => setBoardOrientation(o => o === 'white' ? 'black' : 'white')}
            >
              Flip
            </button>
            <span className="fen-display" title={fen}>{fen.split(' ')[0]}</span>
          </div>

          <div className="key-hint">
            Arrow keys to navigate · click pieces to see moves
          </div>

          {/* Mobile nav buttons */}
          {treeNodes.length > 0 && (
            <div className="move-nav">
              <button className="nav-btn" onClick={goToStart}>|◀</button>
              <button className="nav-btn" onClick={goBack}>◀</button>
              <span className="move-counter">
                {currentNode >= 0 ? `${currentNode + 1}/${treeNodes.length}` : 'Start'}
              </span>
              <button className="nav-btn" onClick={goForward}>▶</button>
              <button className="nav-btn" onClick={goToEnd}>▶|</button>
            </div>
          )}

          {/* Image upload */}
          {inputMode === 'image' && (
            <div className="card mt-16">
              <p className="card-title">Upload Board Photo</p>
              <ImageUpload onFenReceived={onFenReceived} onError={setErrorMsg} />
            </div>
          )}

          {/* FEN input */}
          {inputMode === 'fen' && (
            <div className="card mt-16">
              <label>Paste FEN string</label>
              <div className="fen-input-row">
                <input
                  value={fenInput}
                  onChange={e => setFenInput(e.target.value)}
                  placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                  onKeyDown={e => e.key === 'Enter' && onFenSubmit()}
                />
                <button onClick={onFenSubmit} className="btn btn-primary">Load</button>
              </div>
            </div>
          )}

          {inputMode === 'pgn' && (
            <div className="card mt-16">
              <p className="card-title">Import PGN</p>
              <PgnImportModal
                inline
                onImport={(data) => { handlePgnImport(data); setInputMode('board') }}
                onClose={() => setInputMode('board')}
              />
            </div>
          )}
        </div>

        {/* Right column */}
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

          {/* Evaluation graph */}
          {sf.evalHistory.length > 0 && (
            <div className="card mt-16">
              <p className="card-title">Evaluation</p>
              <EvalGraph
                evalHistory={sf.evalHistory}
                onMoveClick={onGraphMoveClick}
                currentMoveIdx={currentNode}
              />
            </div>
          )}

          {/* Move tree */}
          {treeNodes.length > 0 && (
            <div className="card mt-16">
              <p className="card-title">Moves</p>
              <div className="move-history">
                {treeNodes.map((node, i) => {
                  const isActive  = i === currentNode
                  const siblings  = treeNodes.filter(n => n.parentIdx === node.parentIdx)
                  const isAlt     = siblings.length > 1 && siblings.indexOf(node) > 0
                  const evalEntry = sf.evalHistory[i]
                  const quality   = evalEntry?.quality

                  return (
                    <span
                      key={i}
                      onClick={() => {
                        chess.load(node.fen)
                        setFen(node.fen); setCurrentNode(i)
                        setMoveHistory(chess.history({ verbose: true }))
                        sf.analyse(node.fen)
                      }}
                      className={`move-chip ${isActive ? 'active' : ''} ${isAlt ? 'alt-move' : ''}`}
                      title={quality ? quality.label : ''}
                      style={quality && !isActive ? { borderColor: quality.color + '60' } : {}}
                    >
                      {isAlt ? '(' : ''}{node.san}{quality?.emoji ? ' ' + quality.emoji : ''}{isAlt ? ')' : ''}
                    </span>
                  )
                })}
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
