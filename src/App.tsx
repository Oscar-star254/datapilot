import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { Toast } from './components/ui/Toast'

import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import ForgotPassword from './pages/auth/ForgotPassword'

import Datasets from './pages/app/Datasets'
import DataViewer from './pages/app/DataViewer'
import Cleaning from './pages/app/Cleaning'
import Statistics from './pages/app/Statistics'
import Visualization from './pages/app/Visualization'
import Dashboards from './pages/app/Dashboards'
import SqlPlayground from './pages/app/SqlPlayground'
import TimeSeries from './pages/app/TimeSeries'
import Account from './pages/app/Account'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })

function AppRoutes() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <Routes>
          <Route path="datasets" element={<Datasets />} />
          <Route path="viewer" element={<DataViewer />} />
          <Route path="cleaning" element={<Cleaning />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="visualization" element={<Visualization />} />
          <Route path="dashboards" element={<Dashboards />} />
          <Route path="sql" element={<SqlPlayground />} />
          <Route path="timeseries" element={<TimeSeries />} />
          <Route path="account" element={<Account />} />
          <Route index element={<Navigate to="datasets" replace />} />
        </Routes>
      </AppLayout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/auth/login" element={<Login />} />
              <Route path="/auth/signup" element={<Signup />} />
              <Route path="/auth/forgot-password" element={<ForgotPassword />} />
              <Route path="/auth/callback" element={<Navigate to="/app/datasets" replace />} />
              <Route path="/app/*" element={<AppRoutes />} />
              <Route path="*" element={<Navigate to="/app/datasets" replace />} />
            </Routes>
            <Toast />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
