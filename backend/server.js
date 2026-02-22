// backend/server.js
require('dotenv').config()
const express  = require('express')
const cors     = require('cors')
const path     = require('path')

const analyzeRoute = require('./routes/analyze')

const app  = express()
const PORT = process.env.PORT || 5000

// ── CORS ─────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',')
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true)
    else cb(new Error('Not allowed by CORS'))
  },
}))

app.use(express.json())

// ── Routes ───────────────────────────────────────────────────
app.use('/api', analyzeRoute)

// Health check
app.get('/health', (_, res) => res.json({ ok: true }))

// ── Serve frontend in production ─────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')))
  app.get('*', (_, res) =>
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'))
  )
}

// ── Error handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`))
