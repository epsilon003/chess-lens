// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Navbar      from './components/Navbar'
import LandingPage from './pages/LandingPage'
import AnalyzePage from './pages/AnalyzePage'
import GamesPage   from './pages/GamesPage'
import GameDetail  from './pages/GameDetail'
import './index.css'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner"/></div>
  if (!user)   return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/"        element={<LandingPage />} />
        <Route path="/analyze" element={
          <ProtectedRoute><AnalyzePage /></ProtectedRoute>
        } />
        <Route path="/games"   element={
          <ProtectedRoute><GamesPage /></ProtectedRoute>
        } />
        <Route path="/games/:id" element={
          <ProtectedRoute><GameDetail /></ProtectedRoute>
        } />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
