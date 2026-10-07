'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function MarkdownContent({ content }: { content: string }) {
  return (
    <article className="prose prose-neutral max-w-none prose-headings:font-bold prose-p:leading-8 prose-li:leading-8 text-right" dir="rtl">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  )
}
