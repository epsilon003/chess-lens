// src/services/patternRecognition.js
import { Chess } from 'chess.js'

function getPhase(chess) {
  const vals = { p: 1, n: 3, b: 3, r: 5, q: 9 }
  let mat = 0
  chess.board().forEach(row => row.forEach(sq => { if (sq && sq.type !== 'k') mat += vals[sq.type] || 0 }))
  if (mat > 50) return 'opening'
  if (mat > 20) return 'middlegame'
  return 'endgame'
}

function classifyDrop(drop) {
  if (drop >= 0)    return 'best'
  if (drop >= -30)  return 'good'
  if (drop >= -100) return 'inaccuracy'
  if (drop >= -300) return 'mistake'
  return 'blunder'
}

function evalFen(worker, fen, depth) {
  return new Promise((resolve) => {
    let best = null
    let done = false

    const timeout = setTimeout(() => {
      if (!done) { done = true; worker.removeEventListener('message', handler); resolve(null) }
    }, 6000)

    const handler = (e) => {
      const msg = typeof e.data === 'string' ? e.data : String(e.data)
      if (msg.startsWith('info') && msg.includes('score')) {
        const cp   = msg.match(/score cp (-?\d+)/)
        const mate = msg.match(/score mate (-?\d+)/)
        if (cp)        best = parseInt(cp[1])
        else if (mate) best = parseInt(mate[1]) > 0 ? 9999 : -9999
      }
      if (msg.startsWith('bestmove')) {
        worker.removeEventListener('message', handler)
        clearTimeout(timeout)
        if (!done) { done = true; resolve(best) }
      }
    }

    worker.addEventListener('message', handler)
    worker.postMessage('stop')
    worker.postMessage(`position fen ${fen}`)
    worker.postMessage(`go depth ${depth}`)
  })
}

function bootWorker() {
  return new Promise((resolve, reject) => {
    let worker
    try {
      worker = new Worker(new URL('../workers/stockfish.worker.js', import.meta.url))
    } catch (err) {
      reject(new Error('Could not start Stockfish worker: ' + err.message)); return
    }

    const timeout = setTimeout(() => reject(new Error('Stockfish timed out on startup')), 10000)

    const handler = (e) => {
      const msg = typeof e.data === 'string' ? e.data : String(e.data)
      if (msg === 'uciok' || msg === 'readyok') {
        clearTimeout(timeout)
        worker.removeEventListener('message', handler)
        resolve(worker)
      }
    }

    worker.addEventListener('message', handler)
    worker.onerror = (err) => { clearTimeout(timeout); reject(new Error('Worker error: ' + (err.message || 'unknown'))) }
    worker.postMessage('uci')
    worker.postMessage('setoption name MultiPV value 1')
    worker.postMessage('isready')
  })
}

async function analyseGame(pgn, worker, depth = 10) {
  const chess = new Chess()
  try { chess.loadPgn(pgn) } catch { return [] }

  const moves = chess.history({ verbose: true })
  if (moves.length < 4) return []

  const replay = new Chess()
  const fens   = [replay.fen()]
  for (const m of moves) { replay.move(m); fens.push(replay.fen()) }

  // Evaluate every other position (stride=2) for speed
  const evalMap = {}
  for (let i = 0; i < fens.length; i += 2) {
    const cp = await evalFen(worker, fens[i], depth)
    evalMap[i] = cp
    if (i + 1 < fens.length) evalMap[i + 1] = cp
  }

  const results = []
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i]
    const eb   = evalMap[i]   ?? null
    const ea   = evalMap[i+1] ?? null
    if (eb === null || ea === null) continue

    const isWhite = move.color === 'w'
    const drop    = (isWhite ? ea : -ea) - (isWhite ? eb : -eb)

    const boardAt = new Chess()
    for (let j = 0; j < i; j++) boardAt.move(moves[j])

    results.push({
      moveNumber: Math.ceil((i + 1) / 2),
      halfMove:   i + 1,
      san:        move.san,
      piece:      move.piece,
      color:      move.color,
      isCapture:  !!move.captured,
      phase:      getPhase(boardAt),
      drop,
      quality:    classifyDrop(drop),
    })
  }
  return results
}

function cap(s)      { return s.charAt(0).toUpperCase() + s.slice(1) }
function pct(n, d)   { return Math.round(n / d * 100) + '%' }
function isErr(q)    { return q === 'mistake' || q === 'blunder' }
function isGood(q)   { return q === 'best' || q === 'good' }

function phaseAdvice(phase, type) {
  if (phase === 'opening')    return type === 'blunder' ? 'Study your main opening lines. Most opening blunders come from unfamiliar positions.' : 'Review your opening repertoire — focus on the first 10 moves of your main lines.'
  if (phase === 'middlegame') return type === 'blunder' ? 'Before every move ask: can my opponent take anything? Practice tactics daily.' : 'Work on candidate move selection — always consider 2-3 options before deciding.'
  return type === 'blunder' ? 'Endgame blunders come from impatience. Study K+P, rook, and queen endings.' : 'Practice fundamental endgame technique: opposition, Lucena, Philidor positions.'
}

function pieceAdvice(piece) {
  return ({ n:'Keep knights centralised — avoid placing them on the edge.', b:'Check pawn structure before exchanging bishops.', r:'Put rooks on open files and the 7th rank.', q:'Avoid early queen sorties — overextension is hard to punish correctly.', p:'Each pawn push is permanent — think carefully before advancing.' })[piece] || 'Review games featuring this piece.'
}

function aggregatePatterns(allMoves, playerColor) {
  const mine = allMoves.filter(m => m.color === playerColor)
  if (mine.length < 10) return []
  const patterns = []

  for (const phase of ['opening', 'middlegame', 'endgame']) {
    const pm       = mine.filter(m => m.phase === phase)
    if (pm.length < 4) continue
    const blunders = pm.filter(m => m.quality === 'blunder')
    const mistakes = pm.filter(m => m.quality === 'mistake')
    const inaccs   = pm.filter(m => m.quality === 'inaccuracy')
    const errRate  = (blunders.length + mistakes.length) / pm.length
    if (blunders.length >= 2) {
      patterns.push({ type:'phase_blunder', severity:'high', phase, rate: blunders.length / pm.length,
        title: `${cap(phase)} blunders`,
        detail: `You blundered ${blunders.length} times in the ${phase} (${pct(blunders.length, pm.length)} of your ${phase} moves).`,
        advice: phaseAdvice(phase, 'blunder') })
    } else if ((mistakes.length + inaccs.length) >= 3 && errRate > 0.15) {
      patterns.push({ type:'phase_inaccuracy', severity:'medium', phase, rate: errRate,
        title: `${cap(phase)} inaccuracies`,
        detail: `${pct(mistakes.length + inaccs.length, pm.length)} of your ${phase} moves were inaccuracies or mistakes.`,
        advice: phaseAdvice(phase, 'inaccuracy') })
    }
  }

  for (const [piece, name] of Object.entries({ p:'pawn', n:'knight', b:'bishop', r:'rook', q:'queen' })) {
    const pm   = mine.filter(m => m.piece === piece)
    if (pm.length < 4) continue
    const errs = pm.filter(m => isErr(m.quality))
    if (errs.length >= 2 && errs.length / pm.length > 0.2) {
      patterns.push({ type:'piece_weakness', severity: errs.length >= 4 ? 'high' : 'medium',
        piece, rate: errs.length / pm.length,
        title: `${cap(name)} handling`,
        detail: `${errs.length} of your ${name} moves (${pct(errs.length, pm.length)}) were mistakes or blunders.`,
        advice: pieceAdvice(piece) })
    }
  }

  const early = mine.filter(m => m.halfMove <= 20)
  const late  = mine.filter(m => m.halfMove > 40)
  if (early.length >= 5 && late.length >= 5) {
    const eErr = early.filter(m => isErr(m.quality)).length / early.length
    const lErr = late.filter(m => isErr(m.quality)).length  / late.length
    if (lErr > eErr * 2 && lErr > 0.15) {
      patterns.push({ type:'late_game_collapse', severity:'high', rate: lErr,
        title: 'Late-game accuracy drops',
        detail: `Your error rate after move 40 (${Math.round(lErr*100)}%) is more than double your early-game rate (${Math.round(eErr*100)}%).`,
        advice: 'This often indicates time pressure or fatigue. Practice longer time controls and endgame technique.' })
    }
  }

  for (const phase of ['opening', 'middlegame', 'endgame']) {
    const pm     = mine.filter(m => m.phase === phase)
    if (pm.length < 5) continue
    const goodCt = pm.filter(m => isGood(m.quality)).length
    if (goodCt / pm.length > 0.78) {
      patterns.push({ type:'strength', severity:'positive', phase, rate: goodCt / pm.length,
        title: `Strong ${phase} play`,
        detail: `${pct(goodCt, pm.length)} of your ${phase} moves are good or best.`, advice: null })
    }
  }

  const goodCt = mine.filter(m => isGood(m.quality)).length
  const acc    = goodCt / mine.length
  patterns.push({ type:'overall',
    severity: acc > 0.75 ? 'positive' : acc > 0.55 ? 'medium' : 'high',
    rate: acc, title: 'Overall accuracy',
    detail: `${pct(goodCt, mine.length)} of your moves were good or best across ${mine.length} analysed moves.`,
    advice: acc < 0.55 ? 'Focus on tactical puzzles to reduce your blunder rate.' : null })

  return patterns.sort((a, b) => ({ high:0, medium:1, positive:2 }[a.severity] ?? 1) - ({ high:0, medium:1, positive:2 }[b.severity] ?? 1))
}

export async function analysePatterns(games, playerColor = 'w', onProgress = null) {
  const valid = games.filter(g => g.pgn && g.pgn.trim().length > 10)
  if (valid.length === 0) {
    return { patterns:[], moveCount:0, gameCount:0, analysedGames:0,
      error: 'No games with PGN data found. Save games after playing or importing PGN first.' }
  }

  let worker
  try {
    worker = await bootWorker()
  } catch (err) {
    return { patterns:[], moveCount:0, gameCount:0, analysedGames:0,
      error: 'Could not start analysis engine. Try refreshing the page. (' + err.message + ')' }
  }

  const allMoves = []
  let analysed   = 0

  for (let i = 0; i < valid.length; i++) {
    onProgress?.(i, valid.length)
    try {
      const results = await analyseGame(valid[i].pgn, worker, 10)
      allMoves.push(...results)
      if (results.length > 0) analysed++
    } catch (err) {
      console.warn(`Game ${i+1} failed, skipping:`, err.message)
    }
  }

  onProgress?.(valid.length, valid.length)
  try { worker.terminate() } catch {}

  if (allMoves.length === 0) {
    return { patterns:[], moveCount:0, gameCount:valid.length, analysedGames:0,
      error: 'Could not extract move data. Make sure your saved games include PGN data.' }
  }

  return {
    patterns:      aggregatePatterns(allMoves, playerColor),
    moveCount:     allMoves.filter(m => m.color === playerColor).length,
    gameCount:     valid.length,
    analysedGames: analysed,
    error:         null,
  }
}