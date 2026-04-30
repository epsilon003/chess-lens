// backend/routes/analyze.js
const express  = require('express')
const multer   = require('multer')
const MAGIC = {
  jpeg: [0xFF, 0xD8, 0xFF],
  png:  [0x89, 0x50, 0x4E, 0x47],
  gif:  [0x47, 0x49, 0x46, 0x38],
  webp: [0x52, 0x49, 0x46, 0x46],  // RIFF____WEBP
}
const axios    = require('axios')
const FormData = require('form-data')
const router   = express.Router()
const requireAuth = require('../middleware/requireAuth')

// Store image in memory (no disk writes needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only image files are allowed'), false)
  },
})

function hasValidMagic(buffer) {
  const b = buffer
  return (
    (b[0]===0xFF && b[1]===0xD8 && b[2]===0xFF)           ||  // JPEG
    (b[0]===0x89 && b[1]===0x50 && b[2]===0x4E && b[3]===0x47) ||  // PNG
    (b[0]===0x47 && b[1]===0x49 && b[2]===0x46 && b[3]===0x38) ||  // GIF
    (b[0]===0x52 && b[1]===0x49 && b[2]===0x46 && b[3]===0x46 &&    // WebP
     b[8]===0x57 && b[9]===0x45 && b[10]===0x42 && b[11]===0x50)
  )
}

// POST /api/analyze-image 
// returns { fen, confidence }
router.post('/analyze-image', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' })
  }
  if (!hasValidMagic(req.file.buffer)) {
    return res.status(400).json({ error: 'Invalid image format' })
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
