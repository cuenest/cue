import { Fragment, type ReactNode } from 'react';
import { parseMarkdown, type Block, type Inline } from './markdown';

/**
 * Renders a note body's markdown AST to React elements. Text becomes React text
 * nodes (auto-escaped), and only whitelisted element types are emitted — so
 * untrusted note content can never inject markup. URLs are already gated by
 * safeUrl during parsing.
 */
function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((n, i) => {
    switch (n.t) {
      case 'text':
        return <Fragment key={i}>{n.v}</Fragment>;
      case 'strong':
        return <strong key={i}>{renderInline(n.c)}</strong>;
      case 'em':
        return <em key={i}>{renderInline(n.c)}</em>;
      case 'code':
        return (
          <code key={i} className="rounded-[2px] bg-accent px-1 py-0.5 font-mono text-[0.85em]">
            {n.v}
          </code>
        );
      case 'link':
        return (
          <a
            key={i}
            href={n.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline decoration-primary underline-offset-2 hover:decoration-2"
          >
            {renderInline(n.c)}
          </a>
        );
      case 'image':
        return (
          <img
            key={i}
            src={n.src}
            alt={n.alt}
            loading="lazy"
            className="my-2 max-h-96 max-w-full rounded-[2px] border border-border"
          />
        );
    }
  });
}

function renderBlock(b: Block, i: number): ReactNode {
  switch (b.t) {
    case 'h': {
      const cls = ['mt-4 mb-2 font-sans font-bold tracking-tight', 'text-xl', 'text-lg', 'text-base'][
        Math.min(b.level, 3)
      ];
      const Tag = (`h${Math.min(b.level, 6)}` as unknown) as keyof React.JSX.IntrinsicElements;
      return (
        <Tag key={i} className={cls}>
          {renderInline(b.c)}
        </Tag>
      );
    }
    case 'p':
      return (
        <p key={i} className="my-2 leading-relaxed [overflow-wrap:anywhere]">
          {renderInline(b.c)}
        </p>
      );
    case 'ul':
      return (
        <ul key={i} className="my-2 list-disc space-y-1 pl-5">
          {b.items.map((it, j) => (
            <li key={j}>{renderInline(it)}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={i} className="my-2 list-decimal space-y-1 pl-5">
          {b.items.map((it, j) => (
            <li key={j}>{renderInline(it)}</li>
          ))}
        </ol>
      );
    case 'quote':
      return (
        <blockquote key={i} className="my-2 border-l-2 border-primary pl-3 text-muted-foreground">
          {renderInline(b.c)}
        </blockquote>
      );
    case 'code':
      return (
        <pre
          key={i}
          className="my-2 overflow-x-auto border border-border bg-accent/40 p-3 font-mono text-[12px]"
        >
          <code>{b.v}</code>
        </pre>
      );
    case 'hr':
      return <hr key={i} className="my-4 border-border" />;
    case 'video':
      return (
        <video
          key={i}
          src={b.src}
          controls
          className="my-2 max-h-96 max-w-full rounded-[2px] border border-border"
        />
      );
  }
}

export function Markdown({ body, className }: { body: string; className?: string }) {
  const blocks = parseMarkdown(body);
  if (blocks.length === 0) {
    return <p className="text-sm italic text-muted-foreground">Empty note.</p>;
  }
  return <div className={className}>{blocks.map(renderBlock)}</div>;
}
