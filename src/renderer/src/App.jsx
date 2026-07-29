import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import ToastHost from './components/ToastHost.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Accounts from './pages/Accounts.jsx'
import Groups from './pages/Groups.jsx'
import CreatePost from './pages/CreatePost.jsx'
import History from './pages/History.jsx'
import PendingApproval from './pages/PendingApproval.jsx'
import Settings from './pages/Settings.jsx'
import Logs from './pages/Logs.jsx'

export default function App() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-content">
        <ToastHost />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/create-post" element={<CreatePost />} />
          <Route path="/history" element={<History />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/logs" element={<Logs />} />
        </Routes>
      </main>
    </div>
  )
}
