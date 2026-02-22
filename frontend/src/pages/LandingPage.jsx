// src/pages/LandingPage.jsx
import { useAuth }     from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import './LandingPage.css'

export default function LandingPage() {
  const { user, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  const handleCTA = () => {
    if (user) navigate('/analyze')
    else signInWithGoogle()
  }

  return (
    <div className="landing">
      {/* Hero */}
      <section className="hero">
        <div className="hero-board-bg" aria-hidden="true">
          {Array.from({ length: 64 }).map((_, i) => (
            <div
              key={i}
              className={`sq ${(Math.floor(i / 8) + i) % 2 === 0 ? 'sq-light' : 'sq-dark'}`}
            />
          ))}
        </div>

        <div className="hero-content fade-up">
          <div className="hero-badge">♟ AI-Powered Chess Analysis</div>
          <h1 className="hero-title">
            See the game<br />
            <span className="text-gold">beyond the board</span>
          </h1>
          <p className="hero-sub">
            Upload a photo of any chess position and get instant grandmaster-level
            analysis powered by Stockfish. Save your games. Study your patterns.
          </p>
          <div className="hero-actions">
            <button onClick={handleCTA} className="btn btn-primary hero-btn">
              {user ? 'Start Analyzing →' : 'Get Started Free'}
            </button>
            {!user && (
              <span className="hero-note">Free forever · No credit card</span>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features fade-up fade-up-delay-1">
        <Feature
          icon="📸"
          title="Photo Recognition"
          desc="Snap a photo of any physical board or screenshot. Our vision engine extracts the position automatically."
        />
        <Feature
          icon="⚡"
          title="Stockfish Engine"
          desc="Analysis runs directly in your browser using Stockfish 16 WASM — no server round-trips, instant results."
        />
        <Feature
          icon="💾"
          title="Game Library"
          desc="Save positions and full games to your personal library. Revisit, annotate, and track your progress."
        />
        <Feature
          icon="📱"
          title="Works Everywhere"
          desc="Fully responsive on phone, tablet, and desktop. Analyze on the couch after your OTB game."
        />
      </section>
    </div>
  )
}

function Feature({ icon, title, desc }) {
  return (
    <div className="feature-card card">
      <div className="feature-icon">{icon}</div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-desc">{desc}</p>
    </div>
  )
}
