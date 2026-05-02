// src/hooks/useStockfish.jsx
import { useEffect, useRef, useState, useCallback } from 'react'

// ── Move quality thresholds (centipawns) ──────────────────────
// Based on how much the eval dropped compared to the best move
const QUALITY = [
  { label: 'Brilliant', emoji: '!!', color: '#1bada6', maxDrop: -Infinity, minDrop: -Infinity, special: true },
  { label: 'Best',      emoji: '!',  color: '#5c8a3c', maxDrop:   0  },
  { label: 'Good',      emoji: '',   color: '#a0a0a0', maxDrop:  30  },
  { label: 'Inaccuracy',emoji: '?!', color: '#f0a500', maxDrop: 100  },
  { label: 'Mistake',   emoji: '?',  color: '#e07000', maxDrop: 300  },
  { label: 'Blunder',   emoji: '??', color: '#cc2c2c', maxDrop: Infinity },
]

export function classifyMove(evalBefore, evalAfter, isWhite) {
  // Convert evals to white's perspective
  const before = isWhite ? evalBefore : -evalBefore
  const after  = isWhite ? evalAfter  : -evalAfter
  const drop   = after - before   // negative = got worse for the side that moved

  if (drop >= 0)       return QUALITY[1]  // Best
  if (drop >= -30)     return QUALITY[2]  // Good
  if (drop >= -100)    return QUALITY[3]  // Inaccuracy
  if (drop >= -300)    return QUALITY[4]  // Mistake
  return QUALITY[5]                       // Blunder
}

export function useStockfish() {
  const workerRef    = useRef(null)
  const [ready,      setReady]      = useState(false)
  const [bestMove,   setBestMove]   = useState(null)
  const [lines,      setLines]      = useState([])
  const [score,      setScore]      = useState(null)
  const [depth,      setDepth]      = useState(0)
  const [isThinking, setIsThinking] = useState(false)

  // Eval history: array of { moveNumber, san, eval, quality, isWhite }
  const [evalHistory, setEvalHistory] = useState([])
  const prevScoreRef = useRef(null)

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/stockfish.worker.js', import.meta.url),
      { type: 'classic' }
    )

    worker.onmessage = (e) => {
      const msg = typeof e.data === 'string' ? e.data : String(e.data)

      if (msg === 'uciok' || msg === 'readyok') {
        setReady(true)
        return
      }

      if (msg.startsWith('info') && msg.includes('score')) {
        const depthMatch   = msg.match(/depth (\d+)/)
        const cpMatch      = msg.match(/score cp (-?\d+)/)
        const mateMatch    = msg.match(/score mate (-?\d+)/)
        const pvMatch      = msg.match(/ pv (.+)/)
        const multiPVMatch = msg.match(/multipv (\d+)/)

        if (depthMatch) setDepth(parseInt(depthMatch[1]))

        if (cpMatch) {
          setScore({ type: 'cp', value: parseInt(cpMatch[1]) })
        } else if (mateMatch) {
          setScore({ type: 'mate', value: parseInt(mateMatch[1]) })
        }

        if (pvMatch && multiPVMatch) {
          const pvIdx = parseInt(multiPVMatch[1]) - 1
          const moves = pvMatch[1].trim().split(' ')
          setLines(prev => {
            const next = [...prev]
            next[pvIdx] = moves
            return next
          })
        }
      }

      if (msg.startsWith('bestmove')) {
        const parts = msg.split(' ')
        setBestMove(parts[1] === '(none)' ? null : parts[1])
        setIsThinking(false)
      }
    }

    worker.onerror = (err) => console.error('Stockfish error:', err)

    worker.postMessage('uci')
    worker.postMessage('setoption name MultiPV value 3')
    worker.postMessage('isready')

    workerRef.current = worker
    return () => worker.terminate()
  }, [])

  const analyse = useCallback((fen, searchDepth = 18) => {
    if (!workerRef.current || !ready) return
    setBestMove(null)
    setLines([])
    setScore(null)
    setDepth(0)
    setIsThinking(true)
    workerRef.current.postMessage('stop')
    workerRef.current.postMessage(`position fen ${fen}`)
    workerRef.current.postMessage(`go depth ${searchDepth}`)
  }, [ready])

  // Call this after each move to record eval and classify move quality
  const recordMove = useCallback((san, isWhite, currentScore) => {
    const cp = currentScore?.type === 'cp'
      ? currentScore.value
      : currentScore?.type === 'mate'
        ? (currentScore.value > 0 ? 9999 : -9999)
        : null

    if (cp === null) return

    setEvalHistory(prev => {
      const prevCp  = prevScoreRef.current
      const quality = prevCp !== null
        ? classifyMove(prevCp, cp, isWhite)
        : QUALITY[2]  // default Good if no previous

      prevScoreRef.current = cp

      const moveNum = Math.ceil((prev.length + 1) / 2)
      return [...prev, { moveNum, san, cp, quality, isWhite }]
    })
  }, [])

  const resetEvalHistory = useCallback(() => {
    setEvalHistory([])
    prevScoreRef.current = null
  }, [])

  const stop = useCallback(() => {
    workerRef.current?.postMessage('stop')
    setIsThinking(false)
  }, [])

  return {
    ready, bestMove, lines, score, depth, isThinking,
    evalHistory, analyse, recordMove, resetEvalHistory, stop,
  }
}
