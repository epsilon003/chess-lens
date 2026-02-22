// src/hooks/useStockfish.jsx
import { useEffect, useRef, useState, useCallback } from 'react'

export function useStockfish() {
  const workerRef    = useRef(null)
  const [ready,      setReady]      = useState(false)
  const [bestMove,   setBestMove]   = useState(null)
  const [lines,      setLines]      = useState([])
  const [score,      setScore]      = useState(null)
  const [depth,      setDepth]      = useState(0)
  const [isThinking, setIsThinking] = useState(false)

  useEffect(() => {
    // Classic worker (importScripts-based) — no { type: 'module' } needed
    const worker = new Worker(
      new URL('../workers/stockfish.worker.js', import.meta.url)
      // NOTE: no { type: 'module' } — this is a classic worker using importScripts
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

        if (depthMatch)   setDepth(parseInt(depthMatch[1]))
        if (cpMatch)      setScore({ type: 'cp',   value: parseInt(cpMatch[1]) })
        else if (mateMatch) setScore({ type: 'mate', value: parseInt(mateMatch[1]) })

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

    worker.onerror = (err) => {
      console.error('Stockfish worker error:', err)
    }

    // Boot the UCI engine
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

  const stop = useCallback(() => {
    workerRef.current?.postMessage('stop')
    setIsThinking(false)
  }, [])

  return { ready, bestMove, lines, score, depth, isThinking, analyse, stop }
}
