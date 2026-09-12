import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppErrorBoundary from './components/AppErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './layouts/DashboardLayout'
import CreateTeam from './pages/CreateTeam'
import Dashboard from './pages/Dashboard'
import JoinRequests from './pages/JoinRequests'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import MyTeam from './pages/MyTeam'
import Profile from './pages/Profile'
import Notifications from './pages/Notifications'
import Messages from './pages/Messages'
import PublicProfilePage from './pages/PublicProfilePage'
import Register from './pages/Register'
import Settings from './pages/Settings'
import TeamDetail from './pages/TeamDetail'
import Teams from './pages/Teams'

export default function App() {
  return <AppErrorBoundary><BrowserRouter><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/teams/create" element={<CreateTeam />} />
        <Route path="/teams/:id" element={<TeamDetail />} />
        <Route path="/my-team" element={<MyTeam />} />
        <Route path="/join-requests" element={<JoinRequests />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/messages/:conversationId" element={<Messages />} />
        <Route path="/users/:id" element={<PublicProfilePage />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></BrowserRouter></AppErrorBoundary>
}
