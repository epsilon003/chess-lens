// src/components/UpgradeModal.jsx
import { useState } from 'react'
import { useAuth }  from '../hooks/useAuth'
import { startRazorpayCheckout, applyPromoCode } from '../services/membershipService'
import './UpgradeModal.css'

const FEATURES = [
  'Unlimited pattern analyses per week',
  'Full game history insights',
  'Priority Stockfish depth',
  'Support development',
]

export default function UpgradeModal({ onClose, onProApplied, remaining = 0 }) {
  const { user }      = useAuth()
  const [loading,     setLoading]     = useState(false)
  const [promoCode,   setPromoCode]   = useState('')
  const [promoStatus, setPromoStatus] = useState(null)
  const [promoMsg,    setPromoMsg]    = useState('')
  const [tab,         setTab]         = useState('upgrade')
  const [payError,    setPayError]    = useState('')

  const handleCheckout = async () => {
    if (!user) return
    setLoading(true)
    setPayError('')
    try {
      await startRazorpayCheckout({
        uid:       user.uid,
        email:     user.email,
        name:      user.displayName || '',
        onSuccess: () => {
          setLoading(false)
          onProApplied?.()
          onClose()
        },
        onFailure: (msg) => {
          setLoading(false)
          setPayError(msg || 'Payment failed. Please try again.')
        },
      })
    } catch (err) {
      // User closed modal — not an error
      if (err?.message !== 'user closed') {
        setPayError(err.message || 'Something went wrong.')
      }
      setLoading(false)
    }
  }

  const handlePromo = async () => {
    if (!promoCode.trim() || !user) return
    setLoading(true)
    const result = await applyPromoCode(user.uid, promoCode)
    setPromoStatus(result.success ? 'success' : 'error')
    setPromoMsg(result.message)
    setLoading(false)
    if (result.success) {
      setTimeout(() => { onProApplied?.(); onClose() }, 1500)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box upgrade-modal">

        <div className="modal-header">
          <h2 className="card-title" style={{ margin: 0 }}>Upgrade to Pro</h2>
          <button className="modal-close" onClick={onClose}>&#x2715;</button>
        </div>

        {remaining === 0 ? (
          <div className="upgrade-limit-notice">
            You have used all 3 free pattern analyses this week. Upgrade for unlimited access.
          </div>
        ) : (
          <div className="upgrade-limit-notice upgrade-limit-notice--soft">
            {remaining} free {remaining === 1 ? 'analysis' : 'analyses'} remaining this week.
          </div>
        )}

        <div className="upgrade-tabs">
          <button
            className={`upgrade-tab ${tab === 'upgrade' ? 'active' : ''}`}
            onClick={() => setTab('upgrade')}
          >
            Subscribe
          </button>
          <button
            className={`upgrade-tab ${tab === 'promo' ? 'active' : ''}`}
            onClick={() => setTab('promo')}
          >
            Promo code
          </button>
        </div>

        {tab === 'upgrade' && (
          <div className="upgrade-content">
            <div className="upgrade-price">
              <span className="upgrade-amount">&#8377;199</span>
              <span className="upgrade-period">/ month</span>
            </div>

            <ul className="upgrade-features">
              {FEATURES.map(f => (
                <li key={f} className="upgrade-feature">
                  <span className="upgrade-check">&#10003;</span>
                  {f}
                </li>
              ))}
            </ul>

            {payError && (
              <div className="auth-error" style={{ margin: 0 }}>{payError}</div>
            )}

            <button
              onClick={handleCheckout}
              className="btn btn-primary upgrade-btn"
              disabled={loading}
            >
              {loading ? 'Opening payment...' : 'Pay with Razorpay'}
            </button>

            <p className="upgrade-note">
              Secured by Razorpay. Supports UPI, cards, and netbanking.
              Cancel anytime from your account settings.
            </p>
          </div>
        )}

        {tab === 'promo' && (
          <div className="upgrade-content">
            <p className="upgrade-promo-hint">
              Have a promo code? Enter it below to unlock Pro access instantly.
            </p>
            <div className="promo-input-row">
              <input
                value={promoCode}
                onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoStatus(null) }}
                placeholder="Enter promo code"
                onKeyDown={e => e.key === 'Enter' && handlePromo()}
                className="promo-input"
              />
              <button
                onClick={handlePromo}
                className="btn btn-primary"
                disabled={loading || !promoCode.trim()}
              >
                {loading ? '...' : 'Apply'}
              </button>
            </div>
            {promoStatus === 'success' && (
              <div className="promo-feedback promo-feedback--success">{promoMsg}</div>
            )}
            {promoStatus === 'error' && (
              <div className="promo-feedback promo-feedback--error">{promoMsg}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
