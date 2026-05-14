import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Home from './pages/Home'
import Game from './pages/Game'
import History from './pages/History'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected — redirects to /login if not authenticated */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />
            <Route path="/game/:id" element={<Game />} />
            <Route path="/history" element={<History />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
