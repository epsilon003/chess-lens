// src/components/SaveGameModal.jsx
import { useState, useEffect } from 'react'
import './SaveGameModal.css'

export default function SaveGameModal({ onSave, onClose, isSaving }) {
  const [title, setTitle] = useState(`Position – ${new Date().toLocaleDateString()}`)
  const [notes, setNotes] = useState('')

  // Close on Escape
  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const submit = (e) => {
    e.preventDefault()
    if (title.trim()) onSave({ title: title.trim(), notes: notes.trim() })
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box card">
        <div className="modal-header">
          <h2 className="card-title" style={{ margin: 0 }}>Save Game</h2>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>
        <form onSubmit={submit} className="modal-form">
          <div>
            <label>Title</label>
            <input
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="My game title" autoFocus required
            />
          </div>
          <div>
            <label>Notes (optional)</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="What happened in this game? Any opening, key moments…"
              rows={3}
            />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving…' : '💾 Save Game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
