// src/App.tsx
//
// PURPOSE: Root component and router for the admin panel.
// Handles auth gate — redirects to Login if not authenticated or not admin.
//
// ADDING A NEW SECTION:
//   1. Create src/pages/NewPage.tsx
//   2. Import it here
//   3. Add a <Route> below
//   4. Add nav item to src/components/Sidebar.tsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAdmin } from './hooks/useAdmin'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Universities from './pages/Universities'
import Detection from './pages/Detection'
import UsersPage from './pages/Users'
import SystemHealth from './pages/SystemHealth'

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="p-8 flex items-center justify-center h-full">
      <div className="text-center">
        <p className="text-2xl font-bold text-white mb-2">{title}</p>
        <p className="text-gray-500 text-sm">Coming soon — building in order from the checklist</p>
      </div>
    </div>
  )
}

export default function App() {
  const { user, isAdmin, loading, signOut } = useAdmin()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user || !isAdmin) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-gray-950">
        <Sidebar userEmail={user.email || ''} onSignOut={signOut} />
        <main className="ml-56 flex-1 min-h-screen overflow-y-auto">
          <Routes>
            <Route path="/"             element={<Overview />} />
            <Route path="/universities" element={<Universities />} />
            <Route path="/detection"    element={<Detection />} />
            <Route path="/users"        element={<UsersPage />} />
            <Route path="/cohorts"      element={<ComingSoon title="Cohort Analysis" />} />
            <Route path="/network"      element={<ComingSoon title="Network Density" />} />
            <Route path="/lms-health"   element={<ComingSoon title="LMS Health" />} />
            <Route path="/bulletin"     element={<ComingSoon title="Bulletin & Feed Manager" />} />
            <Route path="/b2b"          element={<ComingSoon title="B2B Pipeline" />} />
            <Route path="/system"       element={<SystemHealth />} />
            <Route path="/compliance"   element={<ComingSoon title="Compliance Centre" />} />
            <Route path="/acquisition"  element={<ComingSoon title="Acquisition Dashboard" />} />
            <Route path="*"             element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}