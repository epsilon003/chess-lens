// src/components/ImageUpload.jsx
import { useRef, useState } from 'react'
import './ImageUpload.css'

export default function ImageUpload({ onFenReceived, onError }) {
  const inputRef        = useRef()
  const [preview,    setPreview]    = useState(null)
  const [status,     setStatus]     = useState('idle') // idle | uploading | success | error
  const [dragOver,   setDragOver]   = useState(false)

  const processFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      onError?.('Please upload an image file.')
      return
    }

    // Show preview
    const url = URL.createObjectURL(file)
    setPreview(url)
    setStatus('uploading')

    try {
      const formData = new FormData()
      formData.append('image', file)

      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error || 'Recognition failed')
      }

      const { fen, confidence } = await res.json()
      setStatus('success')
      onFenReceived(fen, confidence)
    } catch (err) {
      setStatus('error')
      onError?.(err.message)
    }
  }

  const onInputChange = (e) => processFile(e.target.files?.[0])

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    processFile(e.dataTransfer.files?.[0])
  }

  const reset = () => {
    setPreview(null); setStatus('idle')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="image-upload">
      {/* Drop zone */}
      {!preview && (
        <div
          className={`dropzone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef} type="file" accept="image/*"
            onChange={onInputChange} hidden
          />
          <div className="dropzone-icon">📷</div>
          <p className="dropzone-primary">Drop a board photo here</p>
          <p className="dropzone-secondary">or click to browse · JPG, PNG, WEBP</p>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="preview-wrap">
          <img src={preview} alt="Board preview" className="preview-img" />

          <div className={`status-badge status-${status}`}>
            {status === 'uploading' && <><span className="spin-sm" /> Analyzing position…</>}
            {status === 'success'   && <>✓ Position recognized</>}
            {status === 'error'     && <>✗ Recognition failed</>}
          </div>

          <button onClick={reset} className="btn btn-ghost btn-sm mt-8">
            Try another image
          </button>
        </div>
      )}
    </div>
  )
}
