import { describe, it, expect } from 'vitest';
import { parseMarkdown, safeUrl, type Block } from './markdown';

describe('safeUrl (the security gate)', () => {
  it('allows http(s) and same-origin relative/anchor', () => {
    expect(safeUrl('https://example.com/x.png')).toBe('https://example.com/x.png');
    expect(safeUrl('http://a.b')).toBe('http://a.b');
    expect(safeUrl('/local')).toBe('/local');
    expect(safeUrl('#anchor')).toBe('#anchor');
  });

  it('blocks dangerous schemes', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('JavaScript:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html,<script>')).toBeNull();
    expect(safeUrl('  javascript:alert(1)  ')).toBeNull();
    expect(safeUrl('vbscript:msgbox')).toBeNull();
  });
});

describe('parseMarkdown structure', () => {
  it('parses headings, bold, links, lists, code', () => {
    const b = parseMarkdown('# Title\n\nsome **bold** and [a](https://x.com)\n\n- one\n- two');
    expect(b[0]).toMatchObject({ t: 'h', level: 1 });
    const p = b[1] as Extract<Block, { t: 'p' }>;
    expect(p.c.some((n) => n.t === 'strong')).toBe(true);
    expect(p.c.some((n) => n.t === 'link' && n.href === 'https://x.com')).toBe(true);
    expect(b[2]).toMatchObject({ t: 'ul' });
  });

  it('renders a standalone video url as a video block', () => {
    const b = parseMarkdown('https://cdn.example.com/clip.mp4');
    expect(b[0]).toMatchObject({ t: 'video', src: 'https://cdn.example.com/clip.mp4' });
  });
});

describe('injection safety', () => {
  it('treats a <script> tag as plain text, never markup', () => {
    const b = parseMarkdown('<script>alert(1)</script>');
    // it becomes a paragraph of literal text — no element type exists for raw HTML
    expect(b[0]!.t).toBe('p');
    const p = b[0] as Extract<Block, { t: 'p' }>;
    expect(p.c).toEqual([{ t: 'text', v: '<script>alert(1)</script>' }]);
  });

  it('drops a link with a javascript: url but keeps the text', () => {
    const b = parseMarkdown('[click me](javascript:alert(1))');
    const p = b[0] as Extract<Block, { t: 'p' }>;
    expect(p.c.some((n) => n.t === 'link')).toBe(false);
    expect(p.c.some((n) => n.t === 'text' && n.v.includes('click me'))).toBe(true);
  });

  it('drops an image with a non-http src entirely', () => {
    const b = parseMarkdown('![x](data:image/svg+xml,<svg onload=alert(1)>)');
    const p = b[0] as Extract<Block, { t: 'p' }>;
    expect(p.c.some((n) => n.t === 'image')).toBe(false);
  });
});
