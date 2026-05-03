// src/pages/GameDetail.jsx
import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Chessboard }  from 'react-chessboard'
import { Chess }       from 'chess.js'
import { useAuth }     from '../hooks/useAuth'
import { useStockfish } from '../hooks/useStockfish'
import { loadGame, deleteGame } from '../services/gamesService'
import AnalysisPanel   from '../components/AnalysisPanel'
import { SEO } from '../hooks/useSEO'
import './GameDetail.css'

export default function GameDetail() {
  const { id }        = useParams()
  const { user }      = useAuth()
  const navigate      = useNavigate()
  const sf            = useStockfish()

  const [game,    setGame]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [fen,     setFen]     = useState('')
  const [moveIdx, setMoveIdx] = useState(-1)
  const [history, setHistory] = useState([])

  // Store the raw verbose history from the loaded PGN, never mutated
  const pgnHistoryRef = useRef([])

  useEffect(() => {
    loadGame(user.uid, id)
      .then((g) => {
        setGame(g)
        const chess = new Chess()
        if (g.pgn) {
          chess.loadPgn(g.pgn)
        } else {
          chess.load(g.fen)
        }
        const h = chess.history({ verbose: true })
        pgnHistoryRef.current = h
        setHistory(h)
        // Start at beginning
        const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
        setFen(startFen)
        setMoveIdx(-1)
        sf.analyse(startFen)
      })
      .catch(() => navigate('/games'))
      .finally(() => setLoading(false))
  }, [id, user.uid])

  const goToMove = (idx) => {
    // Always replay from scratch using the frozen PGN history
    const temp = new Chess()
    const moves = pgnHistoryRef.current
    for (let i = 0; i <= idx; i++) {
      const m = moves[i]
      temp.move(m.san)  // SAN is unambiguous when replayed in order from start
    }
    const newFen = temp.fen()
    setFen(newFen)
    setMoveIdx(idx)
    sf.analyse(newFen)
  }

  const goToStart = () => {
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    setFen(startFen)
    setMoveIdx(-1)
    sf.analyse(startFen)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this game?')) return
    await deleteGame(user.uid, id)
    navigate('/games')
  }

  if (loading) return <div className="loading-screen"><div className="spinner"/></div>
  if (!game)   return null

  return (
    <div className="page game-detail">
      <SEO
        title={game ? `${game.title} — ${game.white || '?'} vs ${game.black || '?'}` : 'Game Detail'}
        description={game?.notes || 'Review this saved chess game with Stockfish analysis.'}
        canonical={`/games/${id}`}
        noindex={true}
      />
      <nav className="breadcrumb">
        <Link to="/games" className="breadcrumb-link">← My Games</Link>
        <span className="breadcrumb-sep">/</span>
        <span>{game.title}</span>
      </nav>

      <div className="detail-header">
        <div>
          <h1 className="page-title">{game.title}</h1>
          {game.notes && <p className="detail-notes">{game.notes}</p>}
        </div>
        <div className="detail-actions">
          <Link to="/analyze" className="btn btn-ghost">Re-analyse</Link>
          <button onClick={handleDelete} className="btn btn-danger">Delete</button>
        </div>
      </div>

      <div className="detail-grid">
        <div className="board-column">
          <div className="board-wrap">
            <Chessboard
              position={fen}
              arePiecesDraggable={false}
              customBoardStyle={{ borderRadius: '8px', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
              customDarkSquareStyle={{ backgroundColor: '#b58863' }}
              customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
            />
          </div>

          {history.length > 0 && (
            <div className="move-nav">
              <button
                className="nav-btn" disabled={moveIdx < 0}
                onClick={goToStart}
              >|◀</button>
              <button
                className="nav-btn" disabled={moveIdx < 0}
                onClick={() => moveIdx - 1 >= 0 ? goToMove(moveIdx - 1) : goToStart()}
              >◀</button>
              <span className="move-counter">
                {moveIdx >= 0 ? `Move ${moveIdx + 1}/${history.length}` : 'Start'}
              </span>
              <button
                className="nav-btn" disabled={moveIdx >= history.length - 1}
                onClick={() => goToMove(moveIdx + 1)}
              >▶</button>
              <button
                className="nav-btn" disabled={moveIdx >= history.length - 1}
                onClick={() => goToMove(history.length - 1)}
              >▶|</button>
            </div>
          )}
        </div>

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

          {history.length > 0 && (
            <div className="card mt-16">
              <p className="card-title">Moves</p>
              <div className="moves-list">
                {history.reduce((acc, m, i) => {
                  if (i % 2 === 0) acc.push([m])
                  else acc[acc.length - 1].push(m)
                  return acc
                }, []).map((pair, pairIdx) => (
                  <div key={pairIdx} className="move-pair">
                    <span className="move-num">{pairIdx + 1}.</span>
                    <button
                      className={`move-btn ${moveIdx === pairIdx * 2 ? 'active' : ''}`}
                      onClick={() => goToMove(pairIdx * 2)}
                    >{pair[0].san}</button>
                    {pair[1] && (
                      <button
                        className={`move-btn ${moveIdx === pairIdx * 2 + 1 ? 'active' : ''}`}
                        onClick={() => goToMove(pairIdx * 2 + 1)}
                      >{pair[1].san}</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}