// backend/server.js
require('dotenv').config()
const express        = require('express')
const cors           = require('cors')
const razorpayRoutes = require('./routes/razorpay')
const analyzeRoutes  = require('./routes/analyze')

const app  = express()
const PORT = process.env.PORT || 5000

app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || '').split(',').concat(['http://localhost:5173']),
  credentials: true,
}))

// Razorpay webhook needs raw body for signature verification
app.post('/webhook/razorpay', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body
  req.body    = JSON.parse(req.body)
  next()
}, razorpayRoutes)

app.use(express.json())
app.use('/api/razorpay', razorpayRoutes)
app.use('/api',          analyzeRoutes)
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`))
