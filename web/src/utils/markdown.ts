function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function applyInlineMarkdown(value: string) {
  return value
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
}

function flushParagraph(buffer: string[], html: string[]) {
  if (!buffer.length) {
    return
  }

  html.push(`<p>${applyInlineMarkdown(buffer.join('<br />'))}</p>`)
  buffer.length = 0
}

function flushList(listType: 'ul' | 'ol' | null, items: string[], html: string[]) {
  if (!listType || !items.length) {
    return
  }

  html.push(`<${listType}>${items.map((item) => `<li>${applyInlineMarkdown(item)}</li>`).join('')}</${listType}>`)
  items.length = 0
}

export function renderMarkdown(markdown: string) {
  const source = escapeHtml(markdown || '').replace(/\r\n/g, '\n')

  if (!source.trim()) {
    return ''
  }

  const html: string[] = []
  const paragraphBuffer: string[] = []
  const listItems: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let inCodeBlock = false
  let codeBuffer: string[] = []

  for (const line of source.split('\n')) {
    if (line.startsWith('```')) {
      flushParagraph(paragraphBuffer, html)
      flushList(listType, listItems, html)
      listType = null

      if (inCodeBlock) {
        html.push(`<pre><code>${codeBuffer.join('\n')}</code></pre>`)
        codeBuffer = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeBuffer.push(line)
      continue
    }

    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph(paragraphBuffer, html)
      flushList(listType, listItems, html)
      listType = null
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/)
    if (headingMatch) {
      flushParagraph(paragraphBuffer, html)
      flushList(listType, listItems, html)
      listType = null
      const level = headingMatch[1].length
      html.push(`<h${level}>${applyInlineMarkdown(headingMatch[2])}</h${level}>`)
      continue
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/)
    if (quoteMatch) {
      flushParagraph(paragraphBuffer, html)
      flushList(listType, listItems, html)
      listType = null
      html.push(`<blockquote><p>${applyInlineMarkdown(quoteMatch[1])}</p></blockquote>`)
      continue
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/)
    if (unorderedMatch) {
      flushParagraph(paragraphBuffer, html)
      if (listType && listType !== 'ul') {
        flushList(listType, listItems, html)
      }
      listType = 'ul'
      listItems.push(unorderedMatch[1])
      continue
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/)
    if (orderedMatch) {
      flushParagraph(paragraphBuffer, html)
      if (listType && listType !== 'ol') {
        flushList(listType, listItems, html)
      }
      listType = 'ol'
      listItems.push(orderedMatch[1])
      continue
    }

    if (listType) {
      flushList(listType, listItems, html)
      listType = null
    }

    paragraphBuffer.push(trimmed)
  }

  flushParagraph(paragraphBuffer, html)
  flushList(listType, listItems, html)

  if (inCodeBlock) {
    html.push(`<pre><code>${codeBuffer.join('\n')}</code></pre>`)
  }

  return html.join('')
}
