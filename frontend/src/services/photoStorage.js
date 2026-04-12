// src/services/photoStorage.js

const CLOUD_NAME   = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

export async function uploadBoardPhoto(uid, gameId, imageBlob) {
  const formData = new FormData()
  formData.append('file',           imageBlob)
  formData.append('upload_preset',  UPLOAD_PRESET)
  formData.append('folder',         `chesslens/${uid}`)
  formData.append('public_id',      gameId)

  const res  = await fetch(`https://api.cloudinary.com/v1_1/dmh3lgwh5/image/upload`, {
    method: 'POST',
    body:   formData,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Upload failed')
  return data.secure_url
}