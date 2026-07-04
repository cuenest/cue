import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export function Marker({ className }: { className: string }) {
  return <span aria-hidden="true" className={cn('marker', className)} />;
}

/** A horizontal rule across the column with dot pins where it meets the frame. */
export function Panel({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('rise relative border-t border-border', className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <Marker className="-left-[3px] -top-[3px]" />
      <Marker className="-right-[3px] -top-[3px]" />
      {children}
    </div>
  );
}
