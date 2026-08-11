import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import ToastHost from './components/ToastHost.jsx'
import LoginGate from './components/LoginGate.jsx'
import RequireAdmin from './components/RequireAdmin.jsx'
import SetupWizard from './components/SetupWizard.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Accounts from './pages/Accounts.jsx'
import Groups from './pages/Groups.jsx'
import VideoLibrary from './pages/VideoLibrary.jsx'
import Schedule from './pages/Schedule.jsx'
import CreatePost from './pages/CreatePost.jsx'
import History from './pages/History.jsx'
import PendingApproval from './pages/PendingApproval.jsx'
import Settings from './pages/Settings.jsx'
import Logs from './pages/Logs.jsx'
import StaffAccounts from './pages/StaffAccounts.jsx'
import CompetitorPricing from './pages/CompetitorPricing.jsx'

function AppShell() {
  const { role, needsWizard } = useAuth()

  if (!role) return <LoginGate />
  if (role === 'staff' && needsWizard) return <SetupWizard />

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-content">
        <ToastHost />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/video-library" element={<VideoLibrary />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/create-post" element={<CreatePost />} />
          <Route path="/history" element={<History />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="/staff-accounts" element={<RequireAdmin><StaffAccounts /></RequireAdmin>} />
          <Route path="/competitor-pricing" element={<RequireAdmin><CompetitorPricing /></RequireAdmin>} />
          <Route path="/settings" element={<RequireAdmin><Settings /></RequireAdmin>} />
          <Route path="/logs" element={<Logs />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
