// src/workers/stockfish.worker.js
// Loads Stockfish from /public/stockfish.js (local — no CDN dependency)
self.importScripts('/stockfish.js')

let engine = null

function init() {
  if (typeof STOCKFISH === 'undefined') {
    console.error('STOCKFISH not defined — make sure stockfish.js is in frontend/public/')
    return
  }
  engine = STOCKFISH()
  engine.onmessage = function (event) {
    const msg = typeof event === 'object' ? event.data : event
    self.postMessage(msg)
  }
}

self.onmessage = function (event) {
  if (!engine) init()
  if (engine) engine.postMessage(event.data)
}

init()
