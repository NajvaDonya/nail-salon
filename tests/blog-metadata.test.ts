import { describe, it, expect } from 'vitest'
import { buildBlogExcerpt, stripMarkdownForExcerpt } from '@/lib/blog-metadata'

describe('blog metadata', () => {
  it('strips markdown for excerpt', () => {
    const plain = stripMarkdownForExcerpt('# عنوان\n\nHello **world** and [link](https://x.com)')
    expect(plain).toContain('Hello world and link')
    expect(plain).not.toContain('**')
    expect(plain).not.toContain('#')
  })

  it('builds excerpt from content', () => {
    const excerpt = buildBlogExcerpt('## Tips\n\nFirst paragraph about nails.\n\nSecond block.')
    expect(excerpt).toBe('Tips First paragraph about nails. Second block.')
  })

  it('falls back to title when content is empty markdown', () => {
    const excerpt = buildBlogExcerpt('![](/x.jpg)', 200, 'My Post', 'Salon X')
    expect(excerpt).toBe('My Post — Salon X')
  })
})
