import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import '../styles/workspace.css'

export default function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  return <div className="app-shell"><Sidebar open={menuOpen} onOpen={() => setMenuOpen(true)} onClose={() => setMenuOpen(false)} /><main className="app-content"><Outlet /></main></div>
}
