// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Navbar        from './components/Navbar'
import LandingPage   from './pages/LandingPage'
import AuthPage      from './pages/AuthPage'
import AnalyzePage   from './pages/AnalyzePage'
import GamesPage     from './pages/GamesPage'
import GameDetail    from './pages/GameDetail'
import PatternsPage  from './pages/PatternsPage'
import './index.css'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!user)   return <Navigate to="/auth" replace />
  return children
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/"         element={<LandingPage />} />
        <Route path="/auth"     element={<AuthPage />} />
        <Route path="/analyze"  element={<ProtectedRoute><AnalyzePage /></ProtectedRoute>} />
        <Route path="/games"    element={<ProtectedRoute><GamesPage /></ProtectedRoute>} />
        <Route path="/games/:id" element={<ProtectedRoute><GameDetail /></ProtectedRoute>} />
        <Route path="/patterns" element={<ProtectedRoute><PatternsPage /></ProtectedRoute>} />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>
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
