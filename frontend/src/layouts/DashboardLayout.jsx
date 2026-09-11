import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

export default function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen((value) => !value)} /><main className="app-content"><Outlet /></main></div>
}
