import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  className?: string
  children: ReactNode
  onClick?: () => void
  interactive?: boolean
}

export function Card({ className, children, onClick, interactive }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4',
        interactive && 'cursor-pointer hover:border-[var(--primary)] transition-colors',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps { className?: string; children: ReactNode }
export function CardHeader({ className, children }: CardHeaderProps) {
  return <div className={cn('flex items-center justify-between mb-3', className)}>{children}</div>
}

interface CardTitleProps { className?: string; children: ReactNode }
export function CardTitle({ className, children }: CardTitleProps) {
  return <h3 className={cn('text-sm font-semibold text-[var(--foreground)]', className)}>{children}</h3>
}

interface StatCardProps {
  label: string
  value: string | number
  change?: string
  positive?: boolean
  icon?: ReactNode
  className?: string
}

export function StatCard({ label, value, change, positive, icon, className }: StatCardProps) {
  return (
    <Card className={cn('flex items-start gap-3', className)}>
      {icon && (
        <div className="p-2 bg-[var(--muted)] rounded-md text-[var(--accent)]">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide font-medium truncate">{label}</p>
        <p className="text-xl font-bold text-[var(--foreground)] tabular-nums mt-0.5">{value}</p>
        {change && (
          <p className={cn('text-xs mt-0.5', positive ? 'text-[var(--success)]' : 'text-[var(--destructive)]')}>
            {change}
          </p>
        )}
      </div>
    </Card>
  )
}
