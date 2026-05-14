import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Game from './pages/Game.jsx'
import History from './pages/History.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/game/:id" element={<Game />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </BrowserRouter>
  )
}
