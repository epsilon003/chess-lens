// backend/routes/analyze.js
const express  = require('express')
const multer   = require('multer')
const axios    = require('axios')
const FormData = require('form-data')
const router   = express.Router()

// Store image in memory (no disk writes needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only image files are allowed'), false)
  },
})

// ── POST /api/analyze-image ───────────────────────────────────
// Receives an image, forwards to the Python vision service,
// returns { fen, confidence }
router.post('/analyze-image', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' })
  }

  try {
    const visionUrl = process.env.VISION_SERVICE_URL || 'http://localhost:8000'

    // Build multipart request to the Python service
    const form = new FormData()
    form.append('image', req.file.buffer, {
      filename:    req.file.originalname,
      contentType: req.file.mimetype,
    })

    const response = await axios.post(`${visionUrl}/recognize`, form, {
      headers: form.getHeaders(),
      timeout: 30000,  // 30 s — recognition can be slow
    })

    const { fen, confidence } = response.data

    if (!fen) throw new Error('Vision service returned no FEN')

    res.json({ fen, confidence: confidence ?? null })
  } catch (err) {
    console.error('Vision service error:', err.message)

    // Distinguish between service unavailable and recognition failure
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return res.status(503).json({
        error: 'Vision service is unavailable. Start the Python service with: cd vision-service && python app.py',
      })
    }

    res.status(500).json({ error: err.response?.data?.error || err.message })
  }
})

module.exports = router
