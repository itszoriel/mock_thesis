import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { bootstrapAuth, getAccessToken, authApi, setUnauthorizedHandler } from '@/lib/api'
import { useAppStore } from '@/lib/store'

let hasBootstrappedAuth = false
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import MarketplacePage from './pages/MarketplacePage'
import Layout from './components/Layout'
import AnnouncementsPage from './pages/AnnouncementsPage'
import About from '@/pages/About'
import DocumentsPage from './pages/DocumentsPage'
import DocumentRequestPage from './pages/DocumentRequestPage'
import IssuesPage from './pages/IssuesPage'
import BenefitsPage from './pages/BenefitsPage'
import ProgramHistoryPage from './pages/ProgramHistoryPage'
import VerifyDocumentPage from './pages/VerifyDocumentPage'
import ProtectedRoute from './components/ProtectedRoute'
import VerifyEmailPage from './pages/VerifyEmailPage'
import UploadIdPage from './pages/UploadIdPage'
import ErrorBoundary from './components/ErrorBoundary'
import ProfilePage from './pages/ProfilePage'
import MyMarketplacePage from './pages/MyMarketplacePage'
import MarketplaceItemPage from './pages/MarketplaceItemPage'
import AnnouncementDetailPage from './pages/AnnouncementDetailPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ResolveReviewPage from './pages/ResolveReviewPage'

function App() {
  const setAuth = useAppStore((s) => s.setAuth)
  const setAuthBootstrapped = useAppStore((s) => s.setAuthBootstrapped)
  useEffect(() => {
    setUnauthorizedHandler(() => {
      const { forceLogout } = useAppStore.getState()
      forceLogout()
      if (typeof window !== 'undefined') {
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
    })
    return () => { setUnauthorizedHandler(null) }
  }, [])
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      if (hasBootstrappedAuth) { setAuthBootstrapped(true); return }
      try {
        await bootstrapAuth()
        const token = getAccessToken()
        if (token) {
          try {
            const resp = await authApi.getProfile()
            if (!cancelled && resp?.data) {
              setAuth(resp.data, token, '')
            }
          } catch {}
        }
      } catch {}
      hasBootstrappedAuth = true
      if (!cancelled) setAuthBootstrapped(true)
    }
    void init()
    return () => { cancelled = true }
  }, [setAuth])
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="announcements/:id" element={<AnnouncementDetailPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<ErrorBoundary><RegisterPage /></ErrorBoundary>} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route path="upload-id" element={<ProtectedRoute allow={["resident"]}><UploadIdPage /></ProtectedRoute>} />
          <Route path="dashboard" element={<ProtectedRoute allow={["resident"]}><DashboardPage /></ProtectedRoute>} />
          <Route path="profile" element={<ProtectedRoute allow={["resident"]}><ProfilePage /></ProtectedRoute>} />
          <Route path="my-marketplace" element={<ProtectedRoute allow={["resident"]}><MyMarketplacePage /></ProtectedRoute>} />
          <Route path="resolve-review" element={<ProtectedRoute allow={["resident"]}><ResolveReviewPage /></ProtectedRoute>} />
          <Route path="marketplace" element={<MarketplacePage />} />
          <Route path="marketplace/:id" element={<MarketplaceItemPage />} />
          <Route path="about" element={<About />} />
          <Route path="documents" element={<ProtectedRoute allow={["resident","admin","public"]}><DocumentsPage /></ProtectedRoute>} />
          <Route path="documents/requests/:id" element={<LegacyDocRedirect />} />
          <Route path="dashboard/requests/:id" element={<ProtectedRoute allow={["resident"]}><DocumentRequestPage /></ProtectedRoute>} />
          <Route path="issues" element={<ProtectedRoute allow={["resident","admin","public"]}><IssuesPage /></ProtectedRoute>} />
          <Route path="benefits" element={<ProtectedRoute allow={["resident"]}><BenefitsPage /></ProtectedRoute>} />
          <Route path="benefits/history" element={<ProtectedRoute allow={["resident"]}><ProgramHistoryPage /></ProtectedRoute>} />
          <Route path="verify/:requestNumber" element={<VerifyDocumentPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App

function LegacyDocRedirect() {
  const location = useLocation()
  const to = location.pathname.replace('/documents/requests', '/dashboard/requests')
  return <Navigate to={to} replace />
}

