const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface GalleryMetadataInput {
  salonName: string
  originalFileName: string
  sequence: number
}

export interface GalleryMetadata {
  title: string
  alt: string
  description: string
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').trim()
}

function humanizeBaseName(base: string): string {
  const cleaned = base
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  if (UUID_LIKE.test(cleaned.replace(/\s/g, ''))) return ''
  if (/^[0-9a-f-]{20,}$/i.test(cleaned.replace(/\s/g, ''))) return ''
  if (/^(img|dsc|photo|image|pic)[\s_-]*\d*$/i.test(cleaned)) return ''
  return cleaned.slice(0, 120)
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return value.slice(0, max - 1).trimEnd() + '…'
}

export function buildGalleryImageMetadata(input: GalleryMetadataInput): GalleryMetadata {
  const salon = input.salonName.trim() || 'سالن'
  const base = stripExtension(input.originalFileName)
  const human = humanizeBaseName(base)
  const title =
    human ||
    `نمونه کار ${salon} — ${Math.max(1, input.sequence)}`

  const alt = truncate(`تصویر گالری ${salon} — ${title}`, 200)
  const description = `گالری ${salon}`

  return { title, alt, description }
}

export function titleFromImageUrl(imageUrl: string, salonName: string, sequence: number): GalleryMetadata {
  const segment = imageUrl.split('/').pop() || 'image.jpg'
  return buildGalleryImageMetadata({
    salonName,
    originalFileName: segment,
    sequence,
  })
}
