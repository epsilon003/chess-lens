// src/hooks/useOpening.js
// Detects chess openings using the ECO database
// We use a curated list of the most common openings to keep bundle size small.
// For a full database, install the 'chess-openings' npm package.

import { useMemo } from 'react'

// ECO opening database — common openings with their move sequences
// Format: { eco, name, pgn } where pgn is space-separated UCI-like moves
const OPENINGS = [
  // A — Flank openings
  { eco: 'A00', name: "King's Fianchetto Opening",    moves: ['g2g3'] },
  { eco: 'A01', name: 'Nimzo-Larsen Attack',          moves: ['b2b3'] },
  { eco: 'A02', name: "Bird's Opening",               moves: ['f2f4'] },
  { eco: 'A10', name: 'English Opening',              moves: ['c2c4'] },
  { eco: 'A20', name: 'English Opening: Symmetric',   moves: ['c2c4','e7e5'] },
  { eco: 'A40', name: "Queen's Pawn",                 moves: ['d2d4'] },
  { eco: 'A45', name: "Trompowsky Attack",            moves: ['d2d4','g8f6','c1g5'] },

  // B — Semi-open games
  { eco: 'B00', name: 'King\'s Pawn',                 moves: ['e2e4'] },
  { eco: 'B01', name: 'Scandinavian Defense',         moves: ['e2e4','d7d5'] },
  { eco: 'B02', name: "Alekhine's Defense",           moves: ['e2e4','g8f6'] },
  { eco: 'B06', name: 'Modern Defense',               moves: ['e2e4','g7g6'] },
  { eco: 'B07', name: 'Pirc Defense',                 moves: ['e2e4','d7d6','d2d4','g8f6'] },
  { eco: 'B10', name: 'Caro-Kann Defense',            moves: ['e2e4','c7c6'] },
  { eco: 'B12', name: 'Caro-Kann: Advance',           moves: ['e2e4','c7c6','d2d4','d7d5','e4e5'] },
  { eco: 'B20', name: 'Sicilian Defense',             moves: ['e2e4','c7c5'] },
  { eco: 'B21', name: 'Sicilian: Grand Prix Attack',  moves: ['e2e4','c7c5','f2f4'] },
  { eco: 'B22', name: 'Sicilian: Alapin',             moves: ['e2e4','c7c5','c2c3'] },
  { eco: 'B23', name: 'Sicilian: Closed',             moves: ['e2e4','c7c5','b1c3'] },
  { eco: 'B27', name: "Sicilian: King's Indian Attack",moves: ['e2e4','c7c5','g1f3','g7g6'] },
  { eco: 'B30', name: 'Sicilian: Old Sicilian',       moves: ['e2e4','c7c5','g1f3','b8c6'] },
  { eco: 'B40', name: 'Sicilian: French Variation',   moves: ['e2e4','c7c5','g1f3','e7e6'] },
  { eco: 'B50', name: 'Sicilian: Modern',             moves: ['e2e4','c7c5','g1f3','d7d6'] },
  { eco: 'B54', name: 'Sicilian: Dragon',             moves: ['e2e4','c7c5','g1f3','d7d6','d2d4','c5d4','f3d4','g8f6','b1c3','g7g6'] },
  { eco: 'B56', name: 'Sicilian: Najdorf',            moves: ['e2e4','c7c5','g1f3','d7d6','d2d4','c5d4','f3d4','g8f6','b1c3','a7a6'] },
  { eco: 'B57', name: 'Sicilian: Classical',          moves: ['e2e4','c7c5','g1f3','d7d6','d2d4','c5d4','f3d4','g8f6','b1c3','b8c6'] },
  { eco: 'B80', name: 'Sicilian: Scheveningen',       moves: ['e2e4','c7c5','g1f3','d7d6','d2d4','c5d4','f3d4','g8f6','b1c3','e7e6'] },

  // C — Open games
  { eco: 'C00', name: 'French Defense',               moves: ['e2e4','e7e6'] },
  { eco: 'C01', name: 'French: Exchange',             moves: ['e2e4','e7e6','d2d4','d7d5','e4d5'] },
  { eco: 'C02', name: 'French: Advance',              moves: ['e2e4','e7e6','d2d4','d7d5','e4e5'] },
  { eco: 'C10', name: 'French: Rubinstein',           moves: ['e2e4','e7e6','d2d4','d7d5','b1c3','d5e4'] },
  { eco: 'C20', name: "King's Pawn Game",             moves: ['e2e4','e7e5'] },
  { eco: 'C21', name: 'Danish Gambit',                moves: ['e2e4','e7e5','d2d4','e5d4','c2c3'] },
  { eco: 'C23', name: "Bishop's Opening",             moves: ['e2e4','e7e5','f1c4'] },
  { eco: 'C24', name: "Vienna Game",                  moves: ['e2e4','e7e5','b1c3'] },
  { eco: 'C30', name: "King's Gambit",                moves: ['e2e4','e7e5','f2f4'] },
  { eco: 'C40', name: "Petroff's Defense",            moves: ['e2e4','e7e5','g1f3','g8f6'] },
  { eco: 'C41', name: "Philidor Defense",             moves: ['e2e4','e7e5','g1f3','d7d6'] },
  { eco: 'C44', name: "Scotch Game",                  moves: ['e2e4','e7e5','g1f3','b8c6','d2d4'] },
  { eco: 'C45', name: "Scotch: Classical",            moves: ['e2e4','e7e5','g1f3','b8c6','d2d4','e5d4','f3d4'] },
  { eco: 'C46', name: "Three Knights Game",           moves: ['e2e4','e7e5','g1f3','b8c6','b1c3'] },
  { eco: 'C47', name: "Four Knights Game",            moves: ['e2e4','e7e5','g1f3','b8c6','b1c3','g8f6'] },
  { eco: 'C50', name: "Italian Game",                 moves: ['e2e4','e7e5','g1f3','b8c6','f1c4'] },
  { eco: 'C51', name: "Evans Gambit",                 moves: ['e2e4','e7e5','g1f3','b8c6','f1c4','f8c5','b2b4'] },
  { eco: 'C54', name: "Italian: Giuoco Piano",        moves: ['e2e4','e7e5','g1f3','b8c6','f1c4','f8c5','c2c3'] },
  { eco: 'C55', name: "Italian: Two Knights",         moves: ['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6'] },
  { eco: 'C60', name: "Ruy Lopez",                    moves: ['e2e4','e7e5','g1f3','b8c6','f1b5'] },
  { eco: 'C61', name: "Ruy Lopez: Bird's Defense",    moves: ['e2e4','e7e5','g1f3','b8c6','f1b5','b8d4'] },
  { eco: 'C65', name: "Ruy Lopez: Berlin",            moves: ['e2e4','e7e5','g1f3','b8c6','f1b5','g8f6'] },
  { eco: 'C68', name: "Ruy Lopez: Exchange",          moves: ['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6','b5c6'] },
  { eco: 'C70', name: "Ruy Lopez: Modern Steinitz",   moves: ['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6'] },
  { eco: 'C80', name: "Ruy Lopez: Open",              moves: ['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6','f1a4','g8f6','e1g1','b8e4'] },

  // D — Closed games
  { eco: 'D00', name: "Queen's Pawn Game",            moves: ['d2d4','d7d5'] },
  { eco: 'D02', name: "London System",                moves: ['d2d4','d7d5','g1f3','g8f6','c1f4'] },
  { eco: 'D06', name: "Queen's Gambit",               moves: ['d2d4','d7d5','c2c4'] },
  { eco: 'D07', name: "Queen's Gambit: Chigorin",     moves: ['d2d4','d7d5','c2c4','b8c6'] },
  { eco: 'D10', name: "Slav Defense",                 moves: ['d2d4','d7d5','c2c4','c7c6'] },
  { eco: 'D20', name: "Queen's Gambit Accepted",      moves: ['d2d4','d7d5','c2c4','d5c4'] },
  { eco: 'D30', name: "Queen's Gambit Declined",      moves: ['d2d4','d7d5','c2c4','e7e6'] },
  { eco: 'D37', name: "QGD: Classical",               moves: ['d2d4','d7d5','c2c4','e7e6','b1c3','g8f6','g1f3'] },
  { eco: 'D43', name: "Semi-Slav Defense",            moves: ['d2d4','d7d5','c2c4','e7e6','b1c3','g8f6','g1f3','c7c6'] },
  { eco: 'D50', name: "QGD: Modern",                  moves: ['d2d4','d7d5','c2c4','e7e6','b1c3','g8f6','c1g5'] },
  { eco: 'D70', name: "Neo-Grünfeld",                 moves: ['d2d4','g8f6','c2c4','g7g6','g1f3','d7d5'] },
  { eco: 'D80', name: "Grünfeld Defense",             moves: ['d2d4','g8f6','c2c4','g7g6','b1c3','d7d5'] },
  { eco: 'D85', name: "Grünfeld: Exchange",           moves: ['d2d4','g8f6','c2c4','g7g6','b1c3','d7d5','c4d5','f6d5','e2e4','d5c3','b2c3'] },

  // E — Indian defenses
  { eco: 'E00', name: "Catalan Opening",              moves: ['d2d4','g8f6','c2c4','e7e6','g2g3'] },
  { eco: 'E10', name: "Queen's Indian",               moves: ['d2d4','g8f6','c2c4','e7e6','g1f3','b7b6'] },
  { eco: 'E20', name: "Nimzo-Indian Defense",         moves: ['d2d4','g8f6','c2c4','e7e6','b1c3','f8b4'] },
  { eco: 'E60', name: "King's Indian Defense",        moves: ['d2d4','g8f6','c2c4','g7g6'] },
  { eco: 'E61', name: "King's Indian: Normal",        moves: ['d2d4','g8f6','c2c4','g7g6','b1c3','f8g7'] },
  { eco: 'E62', name: "King's Indian: Fianchetto",    moves: ['d2d4','g8f6','c2c4','g7g6','b1c3','f8g7','g1f3','e8g8','g2g3'] },
  { eco: 'E70', name: "King's Indian: Averbakh",      moves: ['d2d4','g8f6','c2c4','g7g6','b1c3','f8g7','e2e4','d7d6','f1e2','e8g8','c1g5'] },
  { eco: 'E80', name: "King's Indian: Sämisch",       moves: ['d2d4','g8f6','c2c4','g7g6','b1c3','f8g7','e2e4','d7d6','f2f3'] },
  { eco: 'E90', name: "King's Indian: Classical",     moves: ['d2d4','g8f6','c2c4','g7g6','b1c3','f8g7','e2e4','d7d6','g1f3','e8g8','f1e2'] },
]

// Sort by length descending so we match the most specific opening first
const SORTED = [...OPENINGS].sort((a, b) => b.moves.length - a.moves.length)

export function detectOpening(moveHistory) {
  // moveHistory: array of verbose move objects from chess.js { from, to, ... }
  if (!moveHistory || moveHistory.length === 0) return null

  const played = moveHistory.map(m => m.from + m.to)

  for (const opening of SORTED) {
    const om = opening.moves
    if (played.length < om.length) continue
    if (om.every((m, i) => played[i] === m)) {
      return { eco: opening.eco, name: opening.name }
    }
  }

  return null
}

export function useOpening(moveHistory) {
  return useMemo(() => detectOpening(moveHistory), [moveHistory])
}
