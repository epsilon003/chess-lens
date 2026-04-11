// src/components/SaveGameModal.jsx
import { useState } from 'react'
import './SaveGameModal.css'

export default function SaveGameModal({ onSave, onClose, isSaving }) {
  const [title, setTitle]       = useState('')
  const [white, setWhite]       = useState('')
  const [black, setBlack]       = useState('')
  const [notes, setNotes]       = useState('')

  const handleSubmit = () => {
    if (!title.trim()) return
    onSave({ title: title.trim(), white: white.trim(), black: black.trim(), notes: notes.trim() })
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h2 className="card-title" style={{ margin: 0 }}>Save Game</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-form">
          <div>
            <label>Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Sicilian study, Tournament game..."
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
          </div>

          <div className="player-row">
            <div>
              <label>White player</label>
              <input
                value={white}
                onChange={e => setWhite(e.target.value)}
                placeholder="White"
              />
            </div>
            <div className="vs-divider">vs</div>
            <div>
              <label>Black player</label>
              <input
                value={black}
                onChange={e => setBlack(e.target.value)}
                placeholder="Black"
              />
            </div>
          </div>

          <div>
            <label>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Opening prep, key moments, things to review..."
              rows={3}
            />
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button
            onClick={handleSubmit}
            className="btn btn-primary"
            disabled={!title.trim() || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save game'}
          </button>
        </div>
      </div>
    </div>
  )
}
