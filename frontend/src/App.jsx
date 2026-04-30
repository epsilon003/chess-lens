// src/App.jsx
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Navbar from './components/Navbar'
import './index.css'

const LandingPage  = lazy(() => import('./pages/LandingPage'))
const AuthPage     = lazy(() => import('./pages/AuthPage'))
const AnalyzePage  = lazy(() => import('./pages/AnalyzePage'))
const GamesPage    = lazy(() => import('./pages/GamesPage'))
const GameDetail   = lazy(() => import('./pages/GameDetail'))
const PatternsPage = lazy(() => import('./pages/PatternsPage'))

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    )
  }

  if (!user) return <Navigate to="/auth" replace />

  return children
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Suspense
        fallback={
          <div className="loading-screen">
            <div className="spinner" />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />

          <Route
            path="/analyze"
            element={
              <ProtectedRoute>
                <AnalyzePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/games"
            element={
              <ProtectedRoute>
                <GamesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/games/:id"
            element={
              <ProtectedRoute>
                <GameDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/patterns"
            element={
              <ProtectedRoute>
                <PatternsPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}