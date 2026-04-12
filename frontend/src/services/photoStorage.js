// src/services/photoStorage.js
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { app } from '../firebase'

const storage = getStorage(app)

export async function uploadBoardPhoto(uid, gameId, imageBlob) {
  if (!uid || !gameId || !imageBlob) throw new Error('Missing required params')

  // In local dev, Firebase Storage CORS may not be configured yet.
  // The game is already saved — just skip the photo upload gracefully.
  const isDev = window.location.hostname === 'localhost'
  if (isDev) {
    console.info('[photoStorage] Skipping upload in local dev (CORS not configured). Configure gsutil cors to enable.')
    return null
  }

  const storageRef = ref(storage, `users/${uid}/games/${gameId}/board.jpg`)
  await uploadBytes(storageRef, imageBlob, { contentType: 'image/jpeg' })
  return await getDownloadURL(storageRef)
}

export async function deleteBoardPhoto(uid, gameId) {
  try {
    const storageRef = ref(storage, `users/${uid}/games/${gameId}/board.jpg`)
    await deleteObject(storageRef)
  } catch {
    // File may not exist
  }
}
