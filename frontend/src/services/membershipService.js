// src/services/membershipService.js
import {
  doc, getDoc, setDoc,
  increment, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

const FREE_ANALYSES_PER_WEEK = 3
const PROMO_CODE             = import.meta.env.VITE_PRO_PROMO_CODE || 'CHESSLENS2024'
const RAZORPAY_KEY_ID        = import.meta.env.VITE_RAZORPAY_KEY_ID

// ── Get membership doc ────────────────────────────────────────
export async function getMembership(uid) {
  if (!uid) return null
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? snap.data() : null
}

// ── Check if user can run analysis ───────────────────────────
export async function canRunAnalysis(uid) {
  const data = await getMembership(uid)
  if (!data) return { allowed: true, remaining: FREE_ANALYSES_PER_WEEK, isPro: false }
  if (data.pro) return { allowed: true, remaining: Infinity, isPro: true }

  const weekKey      = getWeekKey()
  const usage        = data.weeklyAnalysisUsage || {}
  const usedThisWeek = usage[weekKey] || 0
  const remaining    = Math.max(0, FREE_ANALYSES_PER_WEEK - usedThisWeek)

  return { allowed: remaining > 0, remaining, usedThisWeek, weekKey, isPro: false }
}

// ── Record usage ──────────────────────────────────────────────
export async function recordAnalysisUsage(uid) {
  if (!uid) return
  const weekKey = getWeekKey()
  await setDoc(doc(db, 'users', uid), {
    weeklyAnalysisUsage: { [weekKey]: increment(1) },
    lastAnalysisAt:      serverTimestamp(),
  }, { merge: true })
}

// ── Apply promo code ──────────────────────────────────────────
export async function applyPromoCode(uid, code) {
  if (!uid)    return { success: false, message: 'Not signed in.' }
  if (code.trim().toUpperCase() !== PROMO_CODE.toUpperCase()) {
    return { success: false, message: 'Invalid promo code.' }
  }
  await setDoc(doc(db, 'users', uid), {
    pro:       true,
    proSince:  serverTimestamp(),
    proSource: 'promo',
    promoCode: code.trim().toUpperCase(),
  }, { merge: true })
  return { success: true, message: 'Promo code applied! You now have Pro access.' }
}

// ── Start Razorpay checkout ───────────────────────────────────
export function startRazorpayCheckout({ uid, email, name, onSuccess, onFailure }) {
  return new Promise(async (resolve, reject) => {
    // 1. Get subscription ID from backend
    let subscriptionId, keyId
    try {
      const res  = await fetch('/api/razorpay/create-subscription', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uid }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not create subscription')
      subscriptionId = data.subscriptionId
      keyId          = data.keyId || RAZORPAY_KEY_ID
    } catch (err) {
      onFailure?.(err.message)
      reject(err)
      return
    }

    // 2. Load Razorpay script if not already loaded
    if (!window.Razorpay) {
      await loadRazorpayScript()
    }

    // 3. Open Razorpay checkout
    const options = {
      key:             keyId,
      subscription_id: subscriptionId,
      name:            'ChessLens Pro',
      description:     'Monthly subscription — Unlimited pattern analysis',
      image:           '/favicon.ico',
      prefill: {
        name:  name  || '',
        email: email || '',
      },
      theme: { color: '#c0392b' },
      handler: async (response) => {
        // 4. Verify payment on backend
        try {
          const verifyRes = await fetch('/api/razorpay/verify', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              uid,
              razorpay_payment_id:      response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature:       response.razorpay_signature,
            }),
          })
          const verifyData = await verifyRes.json()
          if (!verifyRes.ok) throw new Error(verifyData.error || 'Verification failed')
          onSuccess?.()
          resolve(response)
        } catch (err) {
          onFailure?.(err.message)
          reject(err)
        }
      },
      modal: {
        ondismiss: () => {
          resolve(null)  // user closed modal — not an error
        },
      },
    }

    const rzp = new window.Razorpay(options)
    rzp.on('payment.failed', (response) => {
      onFailure?.(response.error.description)
      reject(new Error(response.error.description))
    })
    rzp.open()
  })
}

// ── Cancel subscription ───────────────────────────────────────
export async function cancelSubscription(uid) {
  const res  = await fetch('/api/razorpay/cancel', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ uid }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Cancel failed')
  return data
}

// ── Helpers ───────────────────────────────────────────────────
function getWeekKey() {
  const d    = new Date()
  const day  = d.getDay()
  const diff = d.getDate() - day
  const mon  = new Date(d)
  mon.setDate(diff)
  mon.setHours(0, 0, 0, 0)
  return mon.toISOString().split('T')[0]
}

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (document.getElementById('razorpay-script')) { resolve(); return }
    const script    = document.createElement('script')
    script.id       = 'razorpay-script'
    script.src      = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload   = resolve
    script.onerror  = () => reject(new Error('Could not load Razorpay'))
    document.head.appendChild(script)
  })
}
