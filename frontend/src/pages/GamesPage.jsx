// src/pages/GamesPage.jsx
import { useEffect, useState } from 'react'
import { Link }          from 'react-router-dom'
import { useAuth }       from '../hooks/useAuth'
import { loadGames, deleteGame } from '../services/gamesService'
import './GamesPage.css'

export default function GamesPage() {
  const { user }       = useAuth()
  const [games,     setGames]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [deleting,  setDeleting]  = useState(null)
  const [search,    setSearch]    = useState('')

  useEffect(() => {
    loadGames(user.uid)
      .then(setGames)
      .finally(() => setLoading(false))
  }, [user.uid])

  const handleDelete = async (e, id) => {
    e.preventDefault()
    if (!confirm('Delete this game?')) return
    setDeleting(id)
    await deleteGame(user.uid, id)
    setGames((g) => g.filter((x) => x.id !== id))
    setDeleting(null)
  }

  const filtered = games.filter((g) =>
    g.title?.toLowerCase().includes(search.toLowerCase()) ||
    g.notes?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page games-page">
      <div className="games-header">
        <h1 className="page-title">My Games</h1>
        <Link to="/analyze" className="btn btn-primary">
          + New Analysis
        </Link>
      </div>

      <input
        className="search-input"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search games…"
      />

      {loading && (
        <div className="loading-screen" style={{ minHeight: 200 }}>
          <div className="spinner" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">♟</span>
          <p>{search ? 'No games match your search.' : "You haven't saved any games yet."}</p>
          {!search && (
            <Link to="/analyze" className="btn btn-primary mt-16">
              Analyze your first position
            </Link>
          )}
        </div>
      )}

      <div className="games-grid">
        {filtered.map((game) => (
          <Link key={game.id} to={`/games/${game.id}`} className="game-card card">
            <div className="game-card-top">
              <h3 className="game-title">{game.title || 'Untitled'}</h3>
              <button
                className="delete-btn"
                onClick={(e) => handleDelete(e, game.id)}
                disabled={deleting === game.id}
                title="Delete game"
              >
                {deleting === game.id ? '…' : '✕'}
              </button>
            </div>

            {game.notes && (
              <p className="game-notes">{game.notes}</p>
            )}

            <div className="game-meta">
              <span className="game-moves">{game.moves?.length || 0} moves</span>
              <span className="game-date">
                {game.createdAt?.toDate?.()?.toLocaleDateString() ?? ''}
              </span>
            </div>

            <div className="game-fen-preview">{game.fen?.split(' ')[0]}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
