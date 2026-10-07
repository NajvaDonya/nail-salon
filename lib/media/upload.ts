import { randomUUID } from 'node:crypto'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function publicUploadUrl(salonId: string, fileName: string): string {
  return `/uploads/${salonId}/${fileName}`
}

export function resolveLocalUploadPath(imageUrl: string): string | null {
  if (!imageUrl.startsWith('/uploads/')) return null
  return path.join(process.cwd(), 'public', imageUrl.replace(/^\//, ''))
}

export async function deleteLocalUploadIfOwned(imageUrl: string): Promise<void> {
  const filePath = resolveLocalUploadPath(imageUrl)
  if (!filePath) return
  try {
    await unlink(filePath)
  } catch {
    // ignore missing file
  }
}

export async function saveUploadedImage(
  salonId: string,
  file: File
): Promise<{ imageUrl: string; mime: string }> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error('فرمت تصویر مجاز نیست')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('حجم تصویر بیش از حد مجاز است')
  }

  const ext = EXT_BY_MIME[file.type] ?? 'jpg'
  const fileName = `${randomUUID()}.${ext}`
  const dir = path.join(process.cwd(), 'public', 'uploads', salonId)
  await mkdir(dir, { recursive: true })

  const buffer = Buffer.from(await file.arrayBuffer())
  const filePath = path.join(dir, fileName)
  await writeFile(filePath, buffer)

  return { imageUrl: publicUploadUrl(salonId, fileName), mime: file.type }
}
