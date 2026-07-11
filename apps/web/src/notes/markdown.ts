/**
 * A tiny, safe-by-construction markdown parser for note bodies.
 *
 * Security: notes sync to shared spaces, so a note is untrusted content. We
 * parse markdown to a structured AST and (in Markdown.tsx) render it to React
 * nodes — never to an HTML string. React escapes all text, so raw `<script>` in
 * a note becomes literal text, not markup. The ONLY injection surface is URL
 * attributes (link/image/video), which all pass through `safeUrl`.
 */

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; href: string; c: Inline[] }
  | { t: 'image'; src: string; alt: string };

export type Block =
  | { t: 'h'; level: number; c: Inline[] }
  | { t: 'p'; c: Inline[] }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'ol'; items: Inline[][] }
  | { t: 'quote'; c: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'hr' }
  | { t: 'video'; src: string };

/** Only http(s) URLs (and same-origin relative/anchor) are allowed. Blocks javascript:, data:, etc. */
export function safeUrl(url: string): string | null {
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (/^(\/|#)/.test(u)) return u;
  return null;
}

const VIDEO_EXT = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;

// ---- inline ---------------------------------------------------------------

function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let i = 0;
  let buf = '';
  const flush = () => {
    if (buf) out.push({ t: 'text', v: buf });
    buf = '';
  };

  while (i < text.length) {
    const rest = text.slice(i);

    // image ![alt](url)
    let m = /^!\[([^\]]*)\]\(([^)\s]+)\)/.exec(rest);
    if (m) {
      const src = safeUrl(m[2]!);
      flush();
      if (src) out.push({ t: 'image', src, alt: m[1]! });
      i += m[0].length;
      continue;
    }
    // link [text](url)
    m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest);
    if (m) {
      const href = safeUrl(m[2]!);
      flush();
      if (href) out.push({ t: 'link', href, c: parseInline(m[1]!) });
      else out.push({ t: 'text', v: m[1]! }); // unsafe url → keep the text, drop the link
      i += m[0].length;
      continue;
    }
    // inline code `x`
    m = /^`([^`]+)`/.exec(rest);
    if (m) {
      flush();
      out.push({ t: 'code', v: m[1]! });
      i += m[0].length;
      continue;
    }
    // bold **x**
    m = /^\*\*([^*]+)\*\*/.exec(rest);
    if (m) {
      flush();
      out.push({ t: 'strong', c: parseInline(m[1]!) });
      i += m[0].length;
      continue;
    }
    // italic *x*
    m = /^\*([^*]+)\*/.exec(rest);
    if (m) {
      flush();
      out.push({ t: 'em', c: parseInline(m[1]!) });
      i += m[0].length;
      continue;
    }
    buf += text[i];
    i += 1;
  }
  flush();
  return out;
}

// ---- blocks ---------------------------------------------------------------

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // code fence ```
    if (/^```/.test(line.trim())) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i]!.trim())) body.push(lines[i++]!);
      i += 1; // closing fence
      blocks.push({ t: 'code', v: body.join('\n') });
      continue;
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ t: 'hr' });
      i += 1;
      continue;
    }

    // heading
    let m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) {
      blocks.push({ t: 'h', level: m[1]!.length, c: parseInline(m[2]!.trim()) });
      i += 1;
      continue;
    }

    // standalone video URL
    if (VIDEO_EXT.test(line.trim()) && safeUrl(line.trim())) {
      blocks.push({ t: 'video', src: safeUrl(line.trim())! });
      i += 1;
      continue;
    }

    // blockquote (consecutive > lines)
    if (/^>\s?/.test(line)) {
      const parts: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!)) parts.push(lines[i++]!.replace(/^>\s?/, ''));
      blocks.push({ t: 'quote', c: parseInline(parts.join(' ')) });
      continue;
    }

    // unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: Inline[][] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i]!)) {
        items.push(parseInline(lines[i++]!.replace(/^\s*[-*+]\s+/, '')));
      }
      blocks.push({ t: 'ul', items });
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: Inline[][] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i]!)) {
        items.push(parseInline(lines[i++]!.replace(/^\s*\d+\.\s+/, '')));
      }
      blocks.push({ t: 'ol', items });
      continue;
    }

    // paragraph (gather consecutive non-blank, non-special lines)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !/^(#{1,6}\s|>|\s*[-*+]\s|\s*\d+\.\s|```)/.test(lines[i]!)
    ) {
      para.push(lines[i++]!);
    }
    blocks.push({ t: 'p', c: parseInline(para.join(' ')) });
  }

  return blocks;
}
