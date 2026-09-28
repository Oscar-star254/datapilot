import { NavLink, useLocation } from 'react-router-dom'
import {
  Database, BarChart2, Settings, LogOut, Sun, Moon, Table2,
  Wand2, FlaskConical, LineChart, LayoutDashboard, User, Code2, Clock
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const NAV = [
  { label: 'Datasets', to: '/app/datasets', icon: Database },
  { label: 'Viewer', to: '/app/viewer', icon: Table2 },
  { label: 'Cleaning', to: '/app/cleaning', icon: Wand2 },
  { label: 'Statistics', to: '/app/statistics', icon: FlaskConical },
  { label: 'Visualization', to: '/app/visualization', icon: BarChart2 },
  { label: 'Dashboards', to: '/app/dashboards', icon: LayoutDashboard },
  { label: 'SQL Playground', to: '/app/sql', icon: Code2 },
  { label: 'Time Series', to: '/app/timeseries', icon: Clock },
]

interface SidebarProps { collapsed?: boolean; onToggle?: () => void }

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()

  return (
    <aside
      className={cn(
        'flex flex-col bg-[var(--card)] border-r border-[var(--border)] h-screen sticky top-0 transition-all duration-200',
        collapsed ? 'w-14' : 'w-52',
      )}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-4 h-14 border-b border-[var(--border)] cursor-pointer shrink-0"
        onClick={onToggle}
      >
        <div className="shrink-0 w-7 h-7 bg-[var(--primary)] rounded flex items-center justify-center">
          <LineChart size={14} className="text-white" />
        </div>
        {!collapsed && (
          <span className="font-display font-bold text-[15px] tracking-tight text-[var(--foreground)]">
            DataPilot
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-3.5 py-2 mx-1.5 rounded-[var(--radius)] text-sm transition-colors mb-0.5',
                isActive
                  ? 'bg-[var(--primary)] text-white font-medium'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]',
                collapsed && 'justify-center px-2',
              )
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={16} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className={cn('border-t border-[var(--border)] p-2 flex gap-1', collapsed ? 'flex-col items-center' : 'items-center')}>
        <NavLink
          to="/app/account"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-colors flex-1',
              isActive ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]',
              collapsed && 'justify-center flex-none',
            )
          }
          title={collapsed ? 'Account' : undefined}
        >
          <User size={14} />
          {!collapsed && 'Account'}
        </NavLink>
        <Button variant="ghost" size="icon" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </Button>
        <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
          <LogOut size={14} />
        </Button>
      </div>
    </aside>
  )
}
