// src/components/ImageUpload.jsx
import { useState, useRef, useCallback } from 'react'
import { Chessboard } from 'react-chessboard'
import { preprocessBoardImage } from '../services/imagePreprocessor'
import { getAuth } from 'firebase/auth'
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
  { value: 'K', label: 'K', title: 'White King' },
  { value: 'Q', label: 'Q', title: 'White Queen' },
  { value: 'R', label: 'R', title: 'White Rook' },
  { value: 'B', label: 'B', title: 'White Bishop' },
  { value: 'N', label: 'N', title: 'White Knight' },
  { value: 'P', label: 'P', title: 'White Pawn' },
  { value: 'k', label: 'k', title: 'Black King' },
  { value: 'q', label: 'q', title: 'Black Queen' },
  { value: 'r', label: 'r', title: 'Black Rook' },
  { value: 'b', label: 'b', title: 'Black Bishop' },
  { value: 'n', label: 'n', title: 'Black Knight' },
  { value: 'p', label: 'p', title: 'Black Pawn' },
]

function confidenceColor(conf) {
  if (conf >= 0.9) return null
  if (conf >= 0.75) return 'rgba(240,165,0,0.32)'
  return 'rgba(192,57,43,0.48)'
}

function fenToGrid(fen) {
  return fen
    .split(' ')[0]
    .split('/')
    .map(rank =>
      rank.split('').flatMap(c =>
        c >= '1' && c <= '8' ? Array(+c).fill('') : c
      )
    )
}

function gridToFen(grid, turn = 'w') {
  const ranks = grid.map(row => {
    let s = '', e = 0
    for (const cell of row) {
      if (!cell) e++
      else {
        if (e) s += e, (e = 0)
        s += cell
      }
    }
    if (e) s += e
    return s
  })
  return `${ranks.join('/')} ${turn} KQkq - 0 1`
}

function squareToRowCol(square) {
  return {
    col: square.charCodeAt(0) - 97,
    row: 8 - Number(square[1]),
  }
}

export default function ImageUpload({ onFenReceived, onError, onPhotoReady }) {
  const [stage, setStage] = useState('idle')
  const [preview, setPreview] = useState(null)
  const [original, setOriginal] = useState(null)
  const [grid, setGrid] = useState(null)
  const [confs, setConfs] = useState(null)
  const [selected, setSelected] = useState(null)
  const [turn, setTurn] = useState('w')
  const [isDemo, setIsDemo] = useState(false)
  const fileRef = useRef(null)

  const handleFile = useCallback(async (file) => {
    if (!file?.type.startsWith('image/')) {
      onError?.('Please upload an image file.')
      return
    }

    setStage('preprocessing')
    setSelected(null)
    setIsDemo(false)

    let blob, previewUrl, originalUrl
    try {
      const res = await preprocessBoardImage(file)
      blob = res.blob
      previewUrl = res.previewUrl
      originalUrl = res.originalUrl
    } catch {
      blob = file
      previewUrl = URL.createObjectURL(file)
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

      const ctrl = new AbortController()
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()

      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        body: fd,
        signal: ctrl.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (res.ok) result = await res.json()
    } catch (err) {
      console.warn('Vision service unavailable, using demo mode:', err)
    }

    if (!result?.fen) {
      const demo = DEMO_POSITIONS[Math.floor(Math.random() * DEMO_POSITIONS.length)]
      result = {
        fen: demo.fen,
        confidence: 0.88,
        cell_confidences: Array.from({ length: 64 }, () => Math.random() * 0.2 + 0.7),
        demo: true,
      }
      setIsDemo(true)
    }

    setGrid(fenToGrid(result.fen))
    setConfs(result.cell_confidences)
    setStage('validating')
  }, [onError, onPhotoReady])

  if (stage === 'idle') {
    return (
      <div className="image-upload">
        <div className="dropzone" onClick={() => fileRef.current.click()}>
          <div className="dropzone-icon">♟</div>
          <div>Drop a board photo here or click to browse</div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={e => handleFile(e.target.files[0])}
        />
      </div>
    )
  }

  if (stage === 'validating') {
    return (
      <Chessboard
        position={gridToFen(grid, turn)}
        arePiecesDraggable={false}
        onSquareClick={setSelected}
      />
    )
  }

  return null
}