// src/pages/Overview.tsx
//
// PURPOSE: Main dashboard — first screen after login.
// Shows the headline metrics that tell the Rute growth story.
// All data is anonymised aggregates — no individual student data shown.
//
// READS FROM:
//   - profiles (total users, admin count)
//   - lms_connections (connection rate)
//   - contacts (social adoption)
//   - team_members (team adoption)
//   - university_registry (university coverage)
//
// MOATS VISIBLE:
//   - Academic Identity Graph — depth and breadth
//   - Transition Layer — onboarding and LMS connection rate
//   - Peer Intelligence — social adoption

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Users, Globe, Wifi, UserCheck, Users2, TrendingUp } from 'lucide-react'

interface OverviewStats {
  totalStudents: number
  totalUniversities: number
  activeUniversities: number
  lmsConnectedCount: number
  lmsConnectionRate: number
  socialConnectionCount: number
  socialConnectionRate: number
  teamMemberCount: number
  teamAdoptionRate: number
  countriesRepresented: number
}

// Metric card component — used throughout all admin sections
function MetricCard({
  label, value, sub, icon: Icon, color = 'green'
}: {
  label: string
  value: string | number
  sub?: string
  icon: any
  color?: 'green' | 'blue' | 'yellow' | 'purple' | 'red'
}) {
  const colors = {
    green:  'bg-green-500/10 text-green-400',
    blue:   'bg-blue-500/10 text-blue-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
    purple: 'bg-purple-500/10 text-purple-400',
    red:    'bg-red-500/10 text-red-400',
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  )
}

export default function Overview() {
  const [stats,   setStats]   = useState<OverviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => { loadStats() }, [])

  const loadStats = async () => {
    setLoading(true)
    setError(null)

    try {
      // Run all queries in parallel for speed
      const [
        profilesRes,
        uniRes,
        lmsRes,
        contactsRes,
        teamsRes,
      ] = await Promise.all([
        // Total students (excluding admins)
        supabase.from('profiles').select('id, university', { count: 'exact' }).neq('use_mode', 'admin'),

        // University coverage
        supabase.from('university_registry').select('country', { count: 'exact' }).eq('is_active', true),

        // LMS connection rate
        supabase.from('lms_connections').select('is_connected', { count: 'exact' }).eq('is_connected', true),

        // Social connections (unique users who have at least one contact)
        supabase.from('contacts').select('user_id').limit(1000),

        // Team adoption
        supabase.from('team_members').select('user_id').limit(1000),
      ])

      const totalStudents = profilesRes.count || 0

      // Count unique countries from universities
      const countries = new Set((uniRes.data || []).map((u: any) => u.country).filter(Boolean))

      // Count unique users with contacts
      const usersWithContacts = new Set((contactsRes.data || []).map((c: any) => c.user_id))

      // Count unique users in teams
      const usersInTeams = new Set((teamsRes.data || []).map((m: any) => m.user_id))

      const lmsCount = lmsRes.count || 0

      setStats({
        totalStudents,
        totalUniversities: uniRes.count || 0,
        activeUniversities: uniRes.count || 0,
        lmsConnectedCount: lmsCount,
        lmsConnectionRate: totalStudents > 0 ? Math.round((lmsCount / totalStudents) * 100) : 0,
        socialConnectionCount: usersWithContacts.size,
        socialConnectionRate: totalStudents > 0 ? Math.round((usersWithContacts.size / totalStudents) * 100) : 0,
        teamMemberCount: usersInTeams.size,
        teamAdoptionRate: totalStudents > 0 ? Math.round((usersInTeams.size / totalStudents) * 100) : 0,
        countriesRepresented: countries.size,
      })
    } catch (err: any) {
      setError('Could not load stats. Check Supabase connection.')
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 h-28 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error}
          <button onClick={loadStats} className="ml-3 underline">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-gray-400 text-sm mt-1">
          Anonymised aggregate metrics — no individual student data
        </p>
      </div>

      {/* ── Headline metrics ── */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Total Students"
          value={stats?.totalStudents.toLocaleString() || 0}
          sub="All time signups"
          icon={Users}
          color="green"
        />
        <MetricCard
          label="Universities"
          value={stats?.activeUniversities.toLocaleString() || 0}
          sub={`${stats?.countriesRepresented || 0} countries`}
          icon={Globe}
          color="blue"
        />
        <MetricCard
          label="LMS Connected"
          value={`${stats?.lmsConnectionRate || 0}%`}
          sub={`${stats?.lmsConnectedCount || 0} students`}
          icon={Wifi}
          color="yellow"
        />
        <MetricCard
          label="Social Adoption"
          value={`${stats?.socialConnectionRate || 0}%`}
          sub={`${stats?.socialConnectionCount || 0} with contacts`}
          icon={UserCheck}
          color="purple"
        />
      </div>

      {/* ── Secondary metrics ── */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Team Adoption"
          value={`${stats?.teamAdoptionRate || 0}%`}
          sub={`${stats?.teamMemberCount || 0} in teams`}
          icon={Users2}
          color="green"
        />
        <MetricCard
          label="Countries"
          value={stats?.countriesRepresented || 0}
          sub="Global reach"
          icon={TrendingUp}
          color="blue"
        />
      </div>

      {/* ── Moat indicators ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Moat Health</h2>
        <div className="space-y-3">
          {[
            { name: 'Academic Identity Graph', score: Math.min(100, Math.round(((stats?.lmsConnectionRate || 0) + (stats?.socialConnectionRate || 0)) / 2)), color: 'bg-green-500' },
            { name: 'Transition Layer', score: stats?.lmsConnectionRate || 0, color: 'bg-blue-500' },
            { name: 'Peer Intelligence', score: stats?.socialConnectionRate || 0, color: 'bg-purple-500' },
            { name: 'Study Group Intelligence', score: stats?.teamAdoptionRate || 0, color: 'bg-yellow-500' },
          ].map(moat => (
            <div key={moat.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">{moat.name}</span>
                <span className="text-xs text-white font-medium">{moat.score}%</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${moat.color} rounded-full transition-all`}
                  style={{ width: `${moat.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
