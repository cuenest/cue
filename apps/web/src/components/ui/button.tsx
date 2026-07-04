import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const press =
  'shadow-[2px_2px_0_0_var(--color-border-strong)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_var(--color-border-strong)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none';

const buttonVariants = cva(
  'inline-flex select-none items-center justify-center whitespace-nowrap rounded-[2px] border font-sans font-semibold tracking-wide transition-[transform,box-shadow,background-color,color,border-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: cn('border-border-strong bg-primary text-primary-foreground', press),
        outline: cn('border-border-strong bg-card text-foreground hover:bg-accent', press),
        ghost:
          'border-transparent bg-transparent text-muted-foreground hover:border-border hover:text-foreground active:translate-y-[1px]',
      },
      size: {
        default: 'h-9 px-4 text-[13px]',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6 text-sm',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export { Button, buttonVariants };
