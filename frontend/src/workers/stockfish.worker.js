// stockfish.worker.js
// Uses Stockfish.js 10 via CDN — works reliably in all browsers without bundler issues.
// (Stockfish 16 WASM requires SharedArrayBuffer + cross-origin isolation headers
//  which need extra server config; Stockfish 10 works everywhere out of the box)

self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js')

let engine = STOCKFISH()

engine.onmessage = function (event) {
  const msg = typeof event === 'object' ? event.data : event
  self.postMessage(msg)
}

self.onmessage = function (event) {
  engine.postMessage(event.data)
}
