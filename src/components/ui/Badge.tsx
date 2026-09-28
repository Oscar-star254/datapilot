import { cn } from '@/lib/utils'
import { type ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'accent' | 'outline'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-mono',
        {
          'bg-[var(--secondary)] text-[var(--foreground)]': variant === 'default',
          'bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)]': variant === 'success',
          'bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] text-[var(--warning)]': variant === 'warning',
          'bg-[color-mix(in_srgb,var(--destructive)_15%,transparent)] text-[var(--destructive)]': variant === 'destructive',
          'bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]': variant === 'accent',
          'border border-[var(--border)] bg-transparent text-[var(--muted-foreground)]': variant === 'outline',
        },
        className,
      )}
    >
      {children}
    </span>
  )
}
