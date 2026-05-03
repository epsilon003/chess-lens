// og-image-worker.js

export default {
  async fetch(request) {
    const url   = new URL(request.url)
    const fen   = url.searchParams.get('fen')   || 'start'
    const title = url.searchParams.get('title') || 'Chess Position'

    const svg = fenToSVG(fen, title)

    return new Response(svg, {
      headers: {
        'Content-Type':  'image/svg+xml',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  },
}

function fenToSVG(fen, title) {
  const PIECES = {
    K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
    k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
  }

  const SQ    = 60
  const board = parseFen(fen)
  let squares = ''

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const light = (r + f) % 2 === 0
      const x = f * SQ, y = r * SQ

      squares += `<rect x='${x}' y='${y}' width='${SQ}' height='${SQ}'
        fill='${light ? '#f0d9b5' : '#b58863'}'/>`

      const piece = board[r][f]
      if (piece) {
        const isW = piece === piece.toUpperCase()
        squares += `<text x='${x + SQ / 2}' y='${y + SQ / 2 + 4}'
          text-anchor='middle' dominant-baseline='middle'
          font-size='44' font-family='serif'
          fill='${isW ? '#1a1612' : '#fff'}'>${PIECES[piece]}</text>`
      }
    }
  }

  // Total board width: 8 * 60 = 480px, centered in 1200px wide image
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="#1a1612"/>
    <!-- Board (480x480), vertically centered at y=75) -->
    <g transform="translate(100,75)">${squares}</g>
    <!-- Right column text -->
    <text x="660" y="160" font-family="Georgia,serif" font-size="48"
      font-weight="bold" fill="#f5f0e8">${escXml(title)}</text>
    <text x="660" y="220" font-family="monospace" font-size="20"
      fill="#8a8278">chess-lens.pages.dev</text>
    <text x="660" y="380" font-family="Georgia,serif" font-size="36"
      fill="#c0392b">&#9823; ChessLens</text>
    <text x="660" y="430" font-family="monospace" font-size="16"
      fill="#6e6862">AI Chess Analysis</text>
  </svg>`
}

function parseFen(fen) {
  if (fen === 'start') {
    fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'
  }
  return fen.split(' ')[0].split('/').map(row => {
    const cells = []
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') {
        cells.push(...Array(parseInt(ch)).fill(null))
      } else {
        cells.push(ch)
      }
    }
    return cells
  })
}

function escXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}