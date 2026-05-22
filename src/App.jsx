import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { useTheme } from './hooks/useTheme'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Home from './pages/Home'
import Game from './pages/Game'
import FinalResults from './pages/FinalResults'
import History from './pages/History'
import Preferences from './pages/Preferences'
import Admin from './pages/Admin'

function ThemeInit({ children }) {
  useTheme() // initialize theme from localStorage on mount
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeInit>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Protected — redirects to /login if not authenticated */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Home />} />
              <Route path="/game/:id" element={<Game />} />
              <Route path="/game/:id/final" element={<FinalResults />} />
              <Route path="/history" element={<History />} />
              <Route path="/preferences" element={<Preferences />} />
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Routes>
        </ThemeInit>
      </AuthProvider>
    </BrowserRouter>
  )
}
