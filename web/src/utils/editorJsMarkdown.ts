export interface EditorJsOutputBlock {
  id?: string
  type: string
  data: Record<string, unknown>
}

export interface EditorJsOutputData {
  version?: string
  time?: number
  blocks: EditorJsOutputBlock[]
}

type EditorJsBlock = EditorJsOutputBlock

type ListItem = string | { content?: string; items?: ListItem[]; meta?: Record<string, unknown> }

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, '')
}

function normalizeMediaType(value: unknown) {
  return value === 'audio' ? 'audio' : 'video'
}

function markdownInlineToEditorHtml(value: unknown) {
  if (typeof value !== 'string') {
    return ''
  }

  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, '<a href="$2">$1</a>')
}

function normalizeInlineHtml(value: unknown) {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(b|strong)>(.*?)<\/\1>/gis, '**$2**')
    .replace(/<(i|em)>(.*?)<\/\1>/gis, '*$2*')
    .replace(/<code>(.*?)<\/code>/gis, '`$1`')
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis, '[$2]($1)')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function createBlock(type: string, data: Record<string, unknown>): EditorJsBlock {
  return { type, data }
}

function flushParagraph(lines: string[], blocks: EditorJsBlock[]) {
  if (lines.length === 0) {
    return
  }

  blocks.push(createBlock('paragraph', { text: lines.map(markdownInlineToEditorHtml).join('<br>') }))
  lines.length = 0
}

function createListItem(content: string): ListItem {
  return {
    content: markdownInlineToEditorHtml(content),
    meta: {},
    items: [],
  }
}

function parseMarkdownList(lines: string[], startIndex: number, ordered: boolean) {
  const items: string[] = []
  let index = startIndex
  const pattern = ordered ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/

  while (index < lines.length) {
    const match = lines[index].match(pattern)
    if (!match) {
      break
    }

    items.push(match[1])
    index += 1
  }

  return { items, nextIndex: index }
}

export function markdownToEditorJsData(markdown: string): EditorJsOutputData {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: EditorJsBlock[] = []
  const paragraphLines: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    const image = line.match(/^!\[([^\]]*)]\(([^)]+)\)$/)
    const media = line.match(/^::(audio|video)\[([^\]]*)]\(([^)]+)\)$/)
    const quote = line.match(/^>\s?(.*)$/)
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/)
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/)

    if (line.trim() === '') {
      flushParagraph(paragraphLines, blocks)
      continue
    }

    if (line.startsWith('```')) {
      flushParagraph(paragraphLines, blocks)
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !lines[index].startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }
      blocks.push(createBlock('code', { code: codeLines.join('\n') }))
      continue
    }

    if (heading) {
      flushParagraph(paragraphLines, blocks)
      blocks.push(createBlock('header', { level: heading[1].length, text: markdownInlineToEditorHtml(heading[2]) }))
      continue
    }

    if (image) {
      flushParagraph(paragraphLines, blocks)
      blocks.push(createBlock('image', { file: { url: image[2] }, caption: markdownInlineToEditorHtml(image[1]), withBorder: false, stretched: false, withBackground: false }))
      continue
    }

    if (media) {
      flushParagraph(paragraphLines, blocks)
      blocks.push(createBlock('media', { mediaType: media[1], title: media[2], url: media[3] }))
      continue
    }

    if (quote) {
      flushParagraph(paragraphLines, blocks)
      blocks.push(createBlock('quote', { text: markdownInlineToEditorHtml(quote[1]), caption: '', alignment: 'left' }))
      continue
    }

    if (unordered || ordered) {
      flushParagraph(paragraphLines, blocks)
      const parsed = parseMarkdownList(lines, index, Boolean(ordered))
      blocks.push(createBlock('list', { style: ordered ? 'ordered' : 'unordered', meta: {}, items: parsed.items.map(createListItem) }))
      index = parsed.nextIndex - 1
      continue
    }

    paragraphLines.push(line)
  }

  flushParagraph(paragraphLines, blocks)
  return { time: Date.now(), blocks }
}

function listItemToMarkdown(item: ListItem, ordered: boolean, index: number, depth = 0): string[] {
  const prefix = ordered ? `${index + 1}. ` : '- '
  const indent = '  '.repeat(depth)

  if (typeof item === 'string') {
    return [`${indent}${prefix}${normalizeInlineHtml(item)}`]
  }

  const lines = [`${indent}${prefix}${normalizeInlineHtml(item.content ?? '')}`]
  const children = Array.isArray(item.items) ? item.items : []
  children.forEach((child, childIndex) => {
    lines.push(...listItemToMarkdown(child, ordered, childIndex, depth + 1))
  })
  return lines
}

export function editorJsDataToMarkdown(data: EditorJsOutputData) {
  return data.blocks
    .map((block) => {
      if (block.type === 'header') {
        const level = Number(block.data.level) || 2
        return `${'#'.repeat(Math.min(Math.max(level, 1), 6))} ${normalizeInlineHtml(block.data.text)}`
      }

      if (block.type === 'list') {
        const ordered = block.data.style === 'ordered'
        const items = Array.isArray(block.data.items) ? (block.data.items as ListItem[]) : []
        return items.flatMap((item, index) => listItemToMarkdown(item, ordered, index)).join('\n')
      }

      if (block.type === 'quote') {
        return normalizeInlineHtml(block.data.text)
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n')
      }

      if (block.type === 'code') {
        return `\`\`\`\n${String(block.data.code ?? '')}\n\`\`\``
      }

      if (block.type === 'image') {
        const file = block.data.file as { url?: string } | undefined
        const url = file?.url ?? ''
        const caption = stripHtml(String(block.data.caption ?? ''))
        return url ? `![${caption}](${url})` : ''
      }

      if (block.type === 'media') {
        const url = String(block.data.url ?? '')
        const title = stripHtml(String(block.data.title ?? ''))
        return url ? `::${normalizeMediaType(block.data.mediaType)}[${title}](${url})` : ''
      }

      return normalizeInlineHtml(block.data.text)
    })
    .filter(Boolean)
    .join('\n\n')
}
