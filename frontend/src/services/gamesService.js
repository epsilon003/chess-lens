// src/services/gamesService.js
import {
  collection, addDoc, getDocs, getDoc,
  doc, updateDoc, deleteDoc,
  serverTimestamp, orderBy, query,
} from 'firebase/firestore'
import { db } from '../firebase'

export async function saveGame(uid, { title, white, black, notes, fen, pgn, moves }) {
  if (!uid) throw new Error('User not authenticated')
  const ref = collection(db, 'users', uid, 'games')
  const docRef = await addDoc(ref, {
    title:     title || 'Untitled',
    white:     white || '',
    black:     black || '',
    notes:     notes || '',
    fen:       fen   || '',
    pgn:       pgn   || '',
    moves:     moves || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export async function loadGames(uid) {
  if (!uid) throw new Error('User not authenticated')
  const ref = collection(db, 'users', uid, 'games')
  const q   = query(ref, orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function loadGame(uid, gameId) {
  if (!uid) throw new Error('User not authenticated')
  const ref  = doc(db, 'users', uid, 'games', gameId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Game not found')
  return { id: snap.id, ...snap.data() }
}

export async function updateGame(uid, gameId, updates) {
  if (!uid) throw new Error('User not authenticated')
  const ref = doc(db, 'users', uid, 'games', gameId)
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() })
}

export async function deleteGame(uid, gameId) {
  if (!uid) throw new Error('User not authenticated')
  const ref = doc(db, 'users', uid, 'games', gameId)
  await deleteDoc(ref)
}
