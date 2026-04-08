// src/components/ImageUpload.jsx
import { useState, useRef } from 'react'
import './ImageUpload.css'

// ── Realistic demo positions ──────────────────────────────────
// Used when the vision service is unavailable (demo / offline mode)
const DEMO_FENS = [
  // Sicilian Dragon middlegame
  'r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R w KQ - 0 9',
  // Ruy Lopez — closed variation
  'r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 w kq - 0 9',
  // Queen's Gambit Declined — typical middlegame
  'r1bq1rk1/ppp2ppp/2nbpn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQR1K1 w - - 4 9',
  // Italian Game — early middlegame
  'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 0 6',
  // King's Indian — classical variation
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQ - 0 7',
  // Endgame — rook and pawns
  '8/5pk1/6p1/4P2p/R4P1P/r5K1/8/8 w - - 0 42',
  // Classic open position
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
  // Tactical position with hanging pieces
  'r3k2r/ppp2ppp/2n1bn2/3qp3/3P4/2NB1N2/PPP2PPP/R1BQR1K1 b kq - 0 10',
]

function getRandomDemoFen() {
  return DEMO_FENS[Math.floor(Math.random() * DEMO_FENS.length)]
}

// ── Simulate a short delay so it feels like processing ────────
function simulateRecognition() {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ fen: getRandomDemoFen(), confidence: 0.91, demo: true })
    }, 1400)
  })
}

export default function ImageUpload({ onFenReceived, onError }) {
  const [preview,   setPreview]   = useState(null)
  const [status,    setStatus]    = useState('idle')  // idle | uploading | success | error
  const [isDragOver, setIsDragOver] = useState(false)
  const [isDemo,    setIsDemo]    = useState(false)
  const fileRef = useRef()

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      onError?.('Please upload an image file.')
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target.result)
    reader.readAsDataURL(file)

    setStatus('uploading')
    setIsDemo(false)

    try {
      // ── Try the real vision service first ─────────────────
      const formData = new FormData()
      formData.append('image', file)

      const controller = new AbortController()
      const timeout    = setTimeout(() => controller.abort(), 8000)  // 8s timeout

      let result = null

      try {
        const res = await fetch('/api/analyze-image', {
          method: 'POST',
          body:   formData,
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (res.ok) {
          result = await res.json()
        }
      } catch (fetchErr) {
        clearTimeout(timeout)
        // Network error or timeout — fall through to demo mode
        console.warn('Vision service unavailable, using demo mode:', fetchErr.message)
      }

      // ── Fall back to demo FEN if service is down ───────────
      if (!result || !result.fen) {
        result = await simulateRecognition()
        setIsDemo(true)
      }

      setStatus('success')
      onFenReceived?.(result.fen)

    } catch (err) {
      setStatus('error')
      onError?.('Recognition failed. Please try again.')
    }
  }

  const onFileChange = e => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const onDrop = e => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const reset = () => {
    setPreview(null)
    setStatus('idle')
    setIsDemo(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="image-upload">
      {!preview ? (
        <div
          className={`dropzone ${isDragOver ? 'drag-over' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
        >
          <div className="dropzone-icon">♟</div>
          <div className="dropzone-primary">Drop a board photo here</div>
          <div className="dropzone-secondary">or click to browse · JPG, PNG supported</div>
        </div>
      ) : (
        <div className="preview-wrap">
          <img src={preview} alt="Board preview" className="preview-img" />

          {status === 'uploading' && (
            <div className="status-badge status-uploading">
              <span className="spin-sm" />
              Analysing board...
            </div>
          )}

          {status === 'success' && (
            <div className="status-badge status-success">
              Position loaded
              {isDemo && (
                <span className="demo-tag" title="Vision service offline — showing a demo position">
                  demo
                </span>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="status-badge status-error">
              Recognition failed
            </div>
          )}

          <button onClick={reset} className="btn btn-ghost" style={{ marginTop: 8 }}>
            Try another image
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={onFileChange}
        style={{ display: 'none' }}
      />
    </div>
  )
}
