export const PHOTO_BUCKET = 'profile-photos'
export const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export function validatePhoto(file) {
  if (!file || !PHOTO_TYPES[file.type]) throw new Error('JPG, PNG veya WebP formatında bir fotoğraf seç.')
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('Fotoğraf en fazla 5 MB olabilir.')
}

// Commit the profile reference before deleting the previous image.
export async function saveProfilePhoto({ storage, updateProfile, userId, oldPath, file }) {
  const bucket = storage.from(PHOTO_BUCKET)
  let path = null
  if (file) {
    validatePhoto(file)
    path = `${userId}/${crypto.randomUUID()}.${PHOTO_TYPES[file.type]}`
    const { error } = await bucket.upload(path, file, { upsert: false, contentType: file.type })
    if (error) throw new Error('Fotoğraf yüklenemedi. Bağlantını ve Supabase fotoğraf kurulumunu kontrol et.')
  }
  try {
    await updateProfile({ avatar_path: path })
  } catch (error) {
    if (path) await bucket.remove([path]).catch(() => {})
    throw error
  }
  if (oldPath) {
    try {
      const { error } = await bucket.remove([oldPath])
      if (error) return 'Profil güncellendi ancak eski fotoğraf depodan kaldırılamadı.'
    } catch {
      return 'Profil güncellendi ancak eski fotoğraf depodan kaldırılamadı.'
    }
  }
  return file ? 'Profil fotoğrafın güncellendi.' : 'Profil fotoğrafın kaldırıldı.'
}
