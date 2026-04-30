// src/components/Sidebar.tsx
//
// PURPOSE: Fixed left sidebar navigation for the admin panel.
// Desktop only — min-width 1280px assumed.
// Each nav item maps to a section from the admin checklist.
// Active state derived from current URL path.

import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Globe, Radar, Users, TrendingUp,
  Network, Wifi, BookOpen, Building2, Activity,
  Shield, Trophy, LogOut,
} from 'lucide-react'

// Each nav item maps to a section in the admin checklist
const NAV_ITEMS = [
  { path: '/',              label: 'Overview',        icon: LayoutDashboard, section: 0  },
  { path: '/universities',  label: 'Universities',     icon: Globe,           section: 2  },
  { path: '/detection',     label: 'Detection',        icon: Radar,           section: 3  },
  { path: '/users',         label: 'Users',            icon: Users,           section: 4  },
  { path: '/cohorts',       label: 'Cohorts',          icon: TrendingUp,      section: 5  },
  { path: '/network',       label: 'Network',          icon: Network,         section: 6  },
  { path: '/lms-health',    label: 'LMS Health',       icon: Wifi,            section: 7  },
  { path: '/bulletin',      label: 'Bulletin',         icon: BookOpen,        section: 9  },
  { path: '/b2b',           label: 'B2B Pipeline',     icon: Building2,       section: 10 },
  { path: '/system',        label: 'System Health',    icon: Activity,        section: 11 },
  { path: '/compliance',    label: 'Compliance',       icon: Shield,          section: 12 },
  { path: '/acquisition',   label: 'Acquisition',      icon: Trophy,          section: 13 },
]

interface SidebarProps {
  userEmail: string
  onSignOut: () => void
}

export default function Sidebar({ userEmail, onSignOut }: SidebarProps) {
  const navigate  = useNavigate()
  const location  = useLocation()

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-gray-950 border-r border-gray-800 flex flex-col z-50">

      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-green-400 font-black text-lg tracking-tight">rute</span>
          <span className="text-[10px] text-gray-500 font-medium bg-gray-800 px-1.5 py-0.5 rounded">admin</span>
        </div>
        <p className="text-[11px] text-gray-600 mt-0.5 truncate">{userEmail}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`
                w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-colors text-left
                ${isActive
                  ? 'bg-green-500/10 text-green-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
              `}>
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-2 py-3 border-t border-gray-800">
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
