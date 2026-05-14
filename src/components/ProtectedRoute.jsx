import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// Wraps any routes that require authentication.
// Shows nothing while the initial session check is in flight,
// then redirects to /login if no user is found.
export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) return null

  if (!user) return <Navigate to="/login" replace />

  return <Outlet />
}
