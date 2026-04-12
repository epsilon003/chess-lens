// src/components/ImageUpload.jsx
import { useState, useRef, useCallback } from 'react'
import { Chessboard }           from 'react-chessboard'
import { preprocessBoardImage } from '../services/imagePreprocessor'
import './ImageUpload.css'

const DEMO_POSITIONS = [
  { fen: 'r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R w KQ - 0 9' },
  { fen: 'r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 w kq - 0 9' },
  { fen: 'r1bq1rk1/ppp2ppp/2nbpn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQR1K1 w - - 4 9' },
  { fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 0 6' },
  { fen: '8/5pk1/6p1/4P2p/R4P1P/r5K1/8/8 w - - 0 42' },
]

const PIECE_OPTIONS = [
  { value: '', label: 'x', title: 'Empty' },
  { value: 'K', label: 'K', title: 'White King'   },
  { value: 'Q', label: 'Q', title: 'White Queen'  },
  { value: 'R', label: 'R', title: 'White Rook'   },
  { value: 'B', label: 'B', title: 'White Bishop' },
  { value: 'N', label: 'N', title: 'White Knight' },
  { value: 'P', label: 'P', title: 'White Pawn'   },
  { value: 'k', label: 'k', title: 'Black King'   },
  { value: 'q', label: 'q', title: 'Black Queen'  },
  { value: 'r', label: 'r', title: 'Black Rook'   },
  { value: 'b', label: 'b', title: 'Black Bishop' },
  { value: 'n', label: 'n', title: 'Black Knight' },
  { value: 'p', label: 'p', title: 'Black Pawn'   },
]

function confidenceColor(conf) {
  if (conf >= 0.90) return null
  if (conf >= 0.75) return 'rgba(240,165,0,0.32)'
  return 'rgba(192,57,43,0.48)'
}

function fenToGrid(fen) {
  const rows = []
  for (const rank of fen.split(' ')[0].split('/')) {
    const row = []
    for (const ch of rank) {
      if (ch >= '1' && ch <= '8') row.push(...Array(parseInt(ch)).fill(''))
      else row.push(ch)
    }
    rows.push(row)
  }
  return rows
}

function gridToFen(grid, turn = 'w') {
  const ranks = grid.map(row => {
    let s = ''; let e = 0
    for (const cell of row) {
      if (!cell) { e++ } else { if (e) { s += e; e = 0 } s += cell }
    }
    if (e) s += e
    return s
  })
  return ranks.join('/') + ` ${turn} KQkq - 0 1`
}

function squareToRowCol(square) {
  const col  = square.charCodeAt(0) - 97
  const rank = parseInt(square[1])
  const row  = 8 - rank
  return { row, col }
}

export default function ImageUpload({ onFenReceived, onError, onPhotoReady }) {
  const [stage,     setStage]     = useState('idle')
  const [preview,   setPreview]   = useState(null)
  const [original,  setOriginal]  = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isDemo,    setIsDemo]    = useState(false)
  const [grid,      setGrid]      = useState(null)
  const [turn,      setTurn]      = useState('w')
  const [confs,     setConfs]     = useState(null)
  const [selected,  setSelected]  = useState(null)
  const fileRef = useRef()

  const handleFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      onError?.('Please upload an image file.')
      return
    }
    setStage('preprocessing')
    setIsDemo(false)
    setSelected(null)

    let blob, previewUrl, originalUrl
    try {
      const res = await preprocessBoardImage(file)
      blob = res.blob; previewUrl = res.previewUrl; originalUrl = res.originalUrl
    } catch {
      blob = file
      previewUrl  = URL.createObjectURL(file)
      originalUrl = previewUrl
    }

    setPreview(previewUrl)
    setOriginal(originalUrl)
    onPhotoReady?.(blob)
    setStage('uploading')

    let result = null
    try {
      const fd = new FormData()
      fd.append('image', blob, 'board.jpg')
      const ctrl    = new AbortController()
      const timeout = setTimeout(() => ctrl.abort(), 10000)
      const res     = await fetch('/api/analyze-image', { method: 'POST', body: fd, signal: ctrl.signal })
      clearTimeout(timeout)
      if (res.ok) result = await res.json()
    } catch (err) {
      console.warn('Vision service offline, demo mode:', err.message)
    }

    if (!result?.fen) {
      const demo = DEMO_POSITIONS[Math.floor(Math.random() * DEMO_POSITIONS.length)]
      result = {
        fen: demo.fen,
        confidence: 0.88,
        cell_confidences: Array.from({ length: 64 }, () =>
          Math.random() < 0.15 ? 0.52 + Math.random() * 0.22 : 0.88 + Math.random() * 0.11
        ),
        demo: true,
      }
      setIsDemo(true)
    }

    setGrid(fenToGrid(result.fen))
    setConfs(result.cell_confidences || Array(64).fill(result.confidence || 0.85))
    setTurn('w')
    setStage('validating')
  }, [onError, onPhotoReady])

  const onFileChange = e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }
  const onDrop       = e => { e.preventDefault(); setIsDragOver(false); handleFile(e.dataTransfer.files?.[0]) }

  const setPiece = (pieceValue) => {
    if (!selected || !grid) return
    const { row, col } = squareToRowCol(selected)
    const ng = grid.map(r => [...r])
    ng[row][col] = pieceValue
    const nc = [...confs]
    nc[row * 8 + col] = 1.0
    setGrid(ng)
    setConfs(nc)
    setSelected(null)
  }

  const confirm = () => {
    if (!grid) return
    setStage('done')
    onFenReceived?.(gridToFen(grid, turn))
  }

  const reset = () => {
    setStage('idle'); setPreview(null); setOriginal(null)
    setGrid(null); setConfs(null); setSelected(null); setIsDemo(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const confStyles = (() => {
    if (!confs || !grid) return {}
    const styles = {}
    const files  = ['a','b','c','d','e','f','g','h']
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const color  = confidenceColor(confs[row * 8 + col])
        const square = files[col] + (8 - row)
        if (color) styles[square] = { background: color }
      }
    }
    return styles
  })()

  const selectedPiece = selected && grid
    ? (() => { const { row, col } = squareToRowCol(selected); return grid[row]?.[col] ?? '' })()
    : null

  const lowConfCount = confs ? confs.filter(c => c < 0.75).length : 0
  const boardWidth   = Math.min((typeof window !== 'undefined' ? window.innerWidth : 400) - 64, 360)

  if (stage === 'idle') return (
    <div className="image-upload">
      <div
        className={`dropzone ${isDragOver ? 'drag-over' : ''}`}
        onClick={() => fileRef.current?.click()}
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
      >
        <div className="dropzone-icon">&#9823;</div>
        <div className="dropzone-primary">Drop a board photo here</div>
        <div className="dropzone-secondary">or click to browse</div>
        <div className="dropzone-hint">Auto-crops and enhances the image before analysis</div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />
    </div>
  )

  if (stage === 'preprocessing' || stage === 'uploading') return (
    <div className="image-upload">
      <div className="upload-status-wrap">
        {preview && <img src={preview} alt="Preview" className="preview-img" />}
        <div className="status-badge status-uploading">
          <span className="spin-sm" />
          {stage === 'preprocessing' ? 'Enhancing image...' : 'Analysing board...'}
        </div>
      </div>
    </div>
  )

  if (stage === 'validating') return (
    <div className="image-upload validation-stage">

      <div className="validation-header">
        <div className="validation-title">Confirm position</div>
        <div className="validation-subtitle">
          {lowConfCount > 0
            ? `${lowConfCount} square${lowConfCount > 1 ? 's' : ''} uncertain — click to correct`
            : 'Recognition confident — review and confirm'}
          {isDemo && <span className="demo-tag">demo</span>}
        </div>
      </div>

      {lowConfCount > 0 && (
        <div className="confidence-legend">
          <div className="legend-item">
            <span className="legend-dot" style={{ background: 'rgba(240,165,0,0.7)' }} />
            Uncertain
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: 'rgba(192,57,43,0.7)' }} />
            Low confidence
          </div>
        </div>
      )}

      <div className="validation-board-wrap">
        <Chessboard
          position={gridToFen(grid, turn)}
          onSquareClick={sq => setSelected(sq === selected ? null : sq)}
          boardWidth={boardWidth}
          arePiecesDraggable={false}
          customSquareStyles={{
            ...confStyles,
            ...(selected ? { [selected]: { background: 'rgba(92,138,60,0.55)', outline: '2px solid #5c8a3c' } } : {}),
          }}
          customDarkSquareStyle={{ backgroundColor: '#b58863' }}
          customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
          customBoardStyle={{ borderRadius: '6px' }}
        />
      </div>

      {selected && (
        <div className="correction-panel">
          <div className="correction-label">
            Set piece on <strong>{selected}</strong>
            <span className="correction-current">
              {selectedPiece ? ` — currently ${selectedPiece}` : ' — currently empty'}
            </span>
          </div>
          <div className="piece-grid">
            {PIECE_OPTIONS.map(opt => (
              <button
                key={opt.value + opt.title}
                className={`piece-btn ${selectedPiece === opt.value ? 'selected' : ''}`}
                title={opt.title}
                onClick={() => setPiece(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="turn-toggle-wrap">
        <span className="turn-label">Side to move</span>
        <div className="turn-toggle">
          {[['w','White'],['b','Black']].map(([val, label]) => (
            <button
              key={val}
              className={`turn-btn ${turn === val ? 'active' : ''}`}
              onClick={() => setTurn(val)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="image-comparison">
        <div className="comparison-item">
          <div className="comparison-label">Original</div>
          <img src={original} alt="Original" className="comparison-img" />
        </div>
        <div className="comparison-item">
          <div className="comparison-label">Enhanced</div>
          <img src={preview}  alt="Enhanced" className="comparison-img" />
        </div>
      </div>

      <div className="validation-actions">
        <button onClick={reset}    className="btn btn-ghost">Try different photo</button>
        <button onClick={confirm}  className="btn btn-primary">Confirm position</button>
      </div>
    </div>
  )

  if (stage === 'done') return (
    <div className="image-upload">
      <div className="upload-status-wrap">
        {preview && <img src={preview} alt="Board" className="preview-img" />}
        <div className="status-badge status-success">
          Position loaded
          {isDemo && <span className="demo-tag">demo</span>}
        </div>
        <button onClick={reset} className="btn btn-ghost" style={{ marginTop: 8 }}>
          Upload another
        </button>
      </div>
    </div>
  )

  return null
}
