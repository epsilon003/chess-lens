// src/components/PgnImportModal.jsx
import { useState } from 'react'
import { Chess } from 'chess.js'
import './PgnImportModal.css'

const EXAMPLE_PGN = `[Event "Immortal Game"]
[White "Adolf Anderssen"]
[Black "Lionel Kieseritzky"]
[Result "1-0"]

1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6
6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6
11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4
Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+
20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7# 1-0`

export default function PgnImportModal({ onImport, onClose }) {
  const [pgn,      setPgn]      = useState('')
  const [error,    setError]    = useState('')
  const [parsed,   setParsed]   = useState(null)  // preview info

  const tryParse = (text) => {
    setPgn(text)
    setError('')
    setParsed(null)

    if (!text.trim()) return

    try {
      const chess = new Chess()
      chess.loadPgn(text.trim())

      // Extract header info for preview
      const header  = chess.header()
      const moves   = chess.history()
      const lastFen = chess.fen()

      setParsed({
        white:   header.White  || 'Unknown',
        black:   header.Black  || 'Unknown',
        event:   header.Event  || '',
        date:    header.Date   || '',
        result:  header.Result || '*',
        moves:   moves.length,
        lastFen,
        pgn:     text.trim(),
        history: moves,
      })
    } catch {
      setError('Invalid PGN — check the format and try again.')
    }
  }

  const handleImport = () => {
    if (!parsed) return
    onImport(parsed)
    onClose()
  }

  const loadExample = () => tryParse(EXAMPLE_PGN)

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box pgn-modal">
        <div className="modal-header">
          <h2 className="card-title" style={{ margin: 0 }}>Import PGN</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <p className="pgn-hint">
          Paste a PGN from Chess.com, Lichess, or any chess tool.
        </p>

        <textarea
          className="pgn-textarea"
          value={pgn}
          onChange={e => tryParse(e.target.value)}
          placeholder={`[Event "..."]\n[White "..."]\n[Black "..."]\n\n1. e4 e5 2. Nf3 ...`}
          rows={10}
          spellCheck={false}
        />

        {error && (
          <div className="pgn-error">{error}</div>
        )}

        {parsed && !error && (
          <div className="pgn-preview">
            <div className="pgn-preview-row">
              <span className="pgn-preview-label">Players</span>
              <span className="pgn-preview-value">
                {parsed.white} vs {parsed.black}
              </span>
            </div>
            {parsed.event && (
              <div className="pgn-preview-row">
                <span className="pgn-preview-label">Event</span>
                <span className="pgn-preview-value">{parsed.event}</span>
              </div>
            )}
            {parsed.date && (
              <div className="pgn-preview-row">
                <span className="pgn-preview-label">Date</span>
                <span className="pgn-preview-value">{parsed.date}</span>
              </div>
            )}
            <div className="pgn-preview-row">
              <span className="pgn-preview-label">Moves</span>
              <span className="pgn-preview-value">{parsed.moves} half-moves</span>
            </div>
            <div className="pgn-preview-row">
              <span className="pgn-preview-label">Result</span>
              <span className="pgn-preview-value">{parsed.result}</span>
            </div>
          </div>
        )}

        <div className="pgn-actions">
          <button onClick={loadExample} className="btn btn-ghost">
            Load example
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button
              onClick={handleImport}
              className="btn btn-primary"
              disabled={!parsed || !!error}
            >
              Import game
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
