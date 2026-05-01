// src/App.tsx
//
// PURPOSE: Root component and router for the admin panel.
// Handles auth gate — redirects to Login if not authenticated or not admin.
// All routes are wrapped in the admin layout (Sidebar + main content area).
//
// ROUTE PROTECTION:
//   - useAdmin checks Supabase session + profiles.use_mode = 'admin'
//   - Loading state shows blank screen while auth resolves
//   - Non-admin users see Login page regardless of route
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

// Placeholder component for sections not yet built
// Replace each with the real page as it's built
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

  // Show nothing while auth resolves — prevents flash of wrong content
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Not authenticated or not admin — show login
  if (!user || !isAdmin) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      </BrowserRouter>
    )
  }

  // Authenticated admin — show full panel with sidebar
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-gray-950">

        {/* Fixed left sidebar — always visible */}
        <Sidebar
          userEmail={user.email || ''}
          onSignOut={signOut}
        />

        {/* Main content area — offset by sidebar width */}
        <main className="ml-56 flex-1 min-h-screen overflow-y-auto">
          <Routes>
            <Route path="/"             element={<Overview />} />
            <Route path="/universities" element={<Universities />} />
            <Route path="/detection"    element={<Detection />} />
            <Route path="/users"        element={<ComingSoon title="User Analytics" />} />
            <Route path="/cohorts"      element={<ComingSoon title="Cohort Analysis" />} />
            <Route path="/network"      element={<ComingSoon title="Network Density" />} />
            <Route path="/lms-health"   element={<ComingSoon title="LMS Health" />} />
            <Route path="/bulletin"     element={<ComingSoon title="Bulletin & Feed Manager" />} />
            <Route path="/b2b"          element={<ComingSoon title="B2B Pipeline" />} />
            <Route path="/system"       element={<ComingSoon title="System Health" />} />
            <Route path="/compliance"   element={<ComingSoon title="Compliance Centre" />} />
            <Route path="/acquisition"  element={<ComingSoon title="Acquisition Dashboard" />} />
            <Route path="*"             element={<Navigate to="/" replace />} />
          </Routes>
        </main>

      </div>
    </BrowserRouter>
  )
}