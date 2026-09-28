import { Toaster } from 'react-hot-toast'

export function Toast() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--card)',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          fontSize: '13px',
          fontFamily: 'var(--font-sans-family)',
        },
        success: { iconTheme: { primary: 'var(--success)', secondary: 'var(--card)' } },
        error: { iconTheme: { primary: 'var(--destructive)', secondary: 'var(--card)' } },
      }}
    />
  )
}
