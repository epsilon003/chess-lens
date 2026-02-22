// src/services/gamesService.js
// All Firestore operations for saving/loading games

import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

// ── Helpers ───────────────────────────────────────────────────
const gamesRef = (uid) => collection(db, 'users', uid, 'games')

// ── Save a new game ───────────────────────────────────────────
export async function saveGame(uid, gameData) {
  // gameData: { title, fen, pgn, moves[], imageUrl, notes }
  const ref = await addDoc(gamesRef(uid), {
    ...gameData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

// ── Load all games for a user ─────────────────────────────────
export async function loadGames(uid) {
  const q    = query(gamesRef(uid), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// ── Load a single game ────────────────────────────────────────
export async function loadGame(uid, gameId) {
  const ref  = doc(db, 'users', uid, 'games', gameId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Game not found')
  return { id: snap.id, ...snap.data() }
}

// ── Update a game ─────────────────────────────────────────────
export async function updateGame(uid, gameId, updates) {
  const ref = doc(db, 'users', uid, 'games', gameId)
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() })
}

// ── Delete a game ─────────────────────────────────────────────
export async function deleteGame(uid, gameId) {
  const ref = doc(db, 'users', uid, 'games', gameId)
  await deleteDoc(ref)
}
