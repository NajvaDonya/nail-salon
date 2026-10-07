function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return value.slice(0, max - 1).trimEnd() + '…'
}

export function stripMarkdownForExcerpt(content: string): string {
  let text = content.trim()
  text = text.replace(/```[\s\S]*?```/g, ' ')
  text = text.replace(/`[^`]+`/g, ' ')
  text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  text = text.replace(/^#{1,6}\s+/gm, '')
  text = text.replace(/^\s*[-*+]\s+/gm, '')
  text = text.replace(/^\s*\d+\.\s+/gm, '')
  text = text.replace(/[*_~>]/g, '')
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

export function buildBlogExcerptFromTitle(title: string, salonName?: string): string {
  const t = title.trim()
  const salon = salonName?.trim()
  if (t && salon) return truncate(`${t} — ${salon}`, 200)
  if (t) return truncate(t, 200)
  return salon ? truncate(`مقاله ${salon}`, 200) : 'مقاله'
}

export function buildBlogExcerpt(
  content: string,
  maxLen = 200,
  fallbackTitle?: string,
  salonName?: string
): string | null {
  const plain = stripMarkdownForExcerpt(content)
  if (plain) return truncate(plain, maxLen)
  if (fallbackTitle?.trim()) {
    return buildBlogExcerptFromTitle(fallbackTitle, salonName)
  }
  return null
}
