import { useState, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'

interface AppLayoutProps { children: ReactNode }

export function AppLayout({ children }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main className="flex-1 overflow-y-auto">
        <div className="min-h-full p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
