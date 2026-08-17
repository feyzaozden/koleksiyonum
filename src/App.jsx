import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import AppPage from './pages/AppPage'
import ImdbPage from './pages/ImdbPage'

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="centered-screen">
        <div className="spinner" />
        <p>Yükleniyor...</p>
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return children
}

function PublicOnlyRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return null
  if (session) return <Navigate to="/app" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
      <Route path="/signup" element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />
      <Route path="/app" element={<ProtectedRoute><AppPage /></ProtectedRoute>} />
      <Route path="/imdb" element={<ProtectedRoute><ImdbPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
