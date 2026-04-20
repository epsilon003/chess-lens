// backend/routes/razorpay.js
const express   = require('express')
const Razorpay  = require('razorpay')
const crypto    = require('crypto')
const admin     = require('firebase-admin')

const router    = express.Router()

const razorpay  = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

// Initialise Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  })
}
const db = admin.firestore()

// ── Create subscription ───────────────────────────────────────
// POST /api/razorpay/create-subscription
router.post('/create-subscription', async (req, res) => {
  const { uid } = req.body
  if (!uid) return res.status(400).json({ error: 'uid required' })

  try {
    const subscription = await razorpay.subscriptions.create({
      plan_id:         process.env.RAZORPAY_PLAN_ID,
      total_count:     12,   // 12 billing cycles (1 year), auto-renews
      quantity:        1,
      notes:           { uid },
    })

    res.json({
      subscriptionId: subscription.id,
      keyId:          process.env.RAZORPAY_KEY_ID,
    })
  } catch (err) {
    console.error('Razorpay subscription error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── Cancel subscription ───────────────────────────────────────
// POST /api/razorpay/cancel
router.post('/cancel', async (req, res) => {
  const { uid } = req.body
  if (!uid) return res.status(400).json({ error: 'uid required' })

  try {
    const userDoc  = await db.collection('users').doc(uid).get()
    const { razorpaySubscriptionId } = userDoc.data() || {}

    if (razorpaySubscriptionId) {
      // cancel_at_cycle_end = 1 means cancel after current billing period
      await razorpay.subscriptions.cancel(razorpaySubscriptionId, true)
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Cancel error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── Verify payment and grant pro ─────────────────────────────
// POST /api/razorpay/verify
// Called from frontend after Razorpay checkout completes
router.post('/verify', async (req, res) => {
  const {
    uid,
    razorpay_payment_id,
    razorpay_subscription_id,
    razorpay_signature,
  } = req.body

  if (!uid || !razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment fields' })
  }

  // Verify signature
  const body      = razorpay_payment_id + '|' + razorpay_subscription_id
  const expected  = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex')

  if (expected !== razorpay_signature) {
    console.error('[razorpay] Signature mismatch')
    return res.status(400).json({ error: 'Invalid payment signature' })
  }

  // Grant pro in Firestore
  try {
    await db.collection('users').doc(uid).set({
      pro:                      true,
      razorpaySubscriptionId:   razorpay_subscription_id,
      razorpayPaymentId:        razorpay_payment_id,
      proSince:                 admin.firestore.FieldValue.serverTimestamp(),
      proCancelledAt:           null,
    }, { merge: true })

    console.log(`[razorpay] Pro granted to uid: ${uid}`)
    res.json({ success: true })
  } catch (err) {
    console.error('Firestore update error:', err)
    res.status(500).json({ error: 'Could not update membership' })
  }
})

// ── Webhook (subscription events) ────────────────────────────
// POST /webhook/razorpay
router.post('/webhook', express.json(), async (req, res) => {
  const signature = req.headers['x-razorpay-signature']
  const body      = JSON.stringify(req.body)

  // Verify webhook signature
  const expected  = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex')

  if (expected !== signature) {
    console.error('[razorpay webhook] Signature mismatch')
    return res.status(400).send('Invalid signature')
  }

  const event        = req.body.event
  const subscription = req.body.payload?.subscription?.entity
  const uid          = subscription?.notes?.uid

  switch (event) {
    case 'subscription.charged': {
      // Renewal payment succeeded — ensure pro stays active
      if (!uid) break
      await db.collection('users').doc(uid).set({
        pro:      true,
        proSince: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
      console.log(`[razorpay] Subscription renewed for uid: ${uid}`)
      break
    }

    case 'subscription.cancelled':
    case 'subscription.completed':
    case 'subscription.expired': {
      // Find user by subscription id
      if (!subscription?.id) break
      const snap = await db.collection('users')
        .where('razorpaySubscriptionId', '==', subscription.id)
        .limit(1).get()

      if (!snap.empty) {
        await snap.docs[0].ref.update({
          pro:                    false,
          razorpaySubscriptionId: null,
          proCancelledAt:         admin.firestore.FieldValue.serverTimestamp(),
        })
        console.log(`[razorpay] Pro revoked for subscription: ${subscription.id}`)
      }
      break
    }

    case 'subscription.halted': {
      // Payment failed repeatedly — notify but keep pro for now
      console.warn(`[razorpay] Subscription halted: ${subscription?.id}`)
      break
    }
  }

  res.json({ received: true })
})

module.exports = router
