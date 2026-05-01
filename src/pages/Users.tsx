// src/pages/Users.tsx
//
// PURPOSE: Anonymised user analytics — no individual student data shown.
// All metrics are aggregates — counts, rates, percentages, distributions.
//
// ANONYMISATION RULES:
//   - No student names, emails, or IDs shown anywhere
//   - Data grouped by university domain, country, or cohort only
//
// READS FROM: profiles, lms_connections, contacts, team_members, sleep_schedule
//
// MOATS VISIBLE:
//   - Academic Identity Graph — profile depth
//   - Transition Layer — onboarding funnel
//   - Peer Intelligence — social adoption
//   - Study Group Intelligence — team adoption

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { RefreshCw } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UniBreakdown {
  university: string
  count: number
}

interface SessionBreakdown {
  session: string
  count: number
}

interface AnalyticsData {
  totalStudents: number
  lmsConnected: number
  lmsConnectionRate: number
  withContacts: number
  socialRate: number
  inTeams: number
  teamRate: number
  withActivities: number
  activitiesRate: number
  withSleep: number
  sleepRate: number
  avgDataDepth: number
  uniBreakdown: UniBreakdown[]
  sessionBreakdown: SessionBreakdown[]
  powerUsersEstimate: number
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Horizontal bar chart — used for university + session breakdown
function BarChart({ data, max }: { data: { label: string; value: number }[]; max: number }) {
  return (
    <div className="space-y-2">
      {data.map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <p className="text-xs text-gray-400 w-48 truncate shrink-0">{item.label}</p>
          <div className="flex-1 h-5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500/60 rounded-full transition-all"
              style={{ width: `${max > 0 ? (item.value / max) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-gray-300 w-8 text-right shrink-0">{item.value}</p>
        </div>
      ))}
    </div>
  )
}

// Simple metric card
function Metric({ label, value, sub, colorClass = 'text-green-400' }: {
  label: string
  value: string | number
  sub?: string
  colorClass?: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
      <p className="text-sm text-gray-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UsersPage() {
  const [data,    setData]    = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => { loadAnalytics() }, [])

  const loadAnalytics = async () => {
    setLoading(true)
    setError(null)

    try {
      // Parallel queries — no individual student data fetched
      const [profilesRes, lmsRes, contactsRes, teamsRes, sleepRes] = await Promise.all([
        supabase.from('profiles').select('university, activities, session_count').neq('use_mode', 'admin'),
        supabase.from('lms_connections').select('user_id, is_connected'),
        supabase.from('contacts').select('user_id'),
        supabase.from('team_members').select('user_id'),
        supabase.from('sleep_schedule').select('user_id'),
      ])

      const profiles  = profilesRes.data  || []
      const lmsData   = lmsRes.data        || []
      const contacts  = contactsRes.data   || []
      const teams     = teamsRes.data      || []
      const sleepData = sleepRes.data      || []

      const total = profiles.length

      // Unique user sets — anonymised counts only
      const lmsConnectedCount = lmsData.filter((l: any) => l.is_connected).length
      const contactCount      = new Set(contacts.map((c: any) => c.user_id)).size
      const teamCount         = new Set(teams.map((t: any) => t.user_id)).size
      const sleepCount        = new Set(sleepData.map((s: any) => s.user_id)).size
      const activitiesCount   = profiles.filter((p: any) => p.activities && p.activities.length > 0).length

      // University breakdown — grouped by university name
      const uniCounts: Record<string, number> = {}
      profiles.forEach((p: any) => {
        const uni = p.university || 'Unknown'
        uniCounts[uni] = (uniCounts[uni] || 0) + 1
      })
      const uniBreakdown = Object.entries(uniCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([university, count]) => ({ university, count }))

      // Session count distribution
      const sessionBuckets: Record<string, number> = {
        '1 session': 0, '2 sessions': 0, '3-5 sessions': 0,
        '6-10 sessions': 0, '10+ sessions': 0,
      }
      profiles.forEach((p: any) => {
        const s = p.session_count || 0
        if (s <= 1)       sessionBuckets['1 session']++
        else if (s === 2) sessionBuckets['2 sessions']++
        else if (s <= 5)  sessionBuckets['3-5 sessions']++
        else if (s <= 10) sessionBuckets['6-10 sessions']++
        else              sessionBuckets['10+ sessions']++
      })
      const sessionBreakdown = Object.entries(sessionBuckets)
        .map(([session, count]) => ({ session, count }))

      // Rates
      const lmsRate        = total > 0 ? lmsConnectedCount / total : 0
      const socialRate     = total > 0 ? contactCount      / total : 0
      const teamRate       = total > 0 ? teamCount         / total : 0
      const activitiesRate = total > 0 ? activitiesCount   / total : 0
      const sleepRate      = total > 0 ? sleepCount        / total : 0

      // Average data depth score — acquisition headline metric
      // Weighted: LMS(30) + Social(20) + Team(20) + Activities(15) + Sleep(15) = 100
      const avgDataDepth = Math.round(
        (lmsRate * 30) + (socialRate * 20) + (teamRate * 20) +
        (activitiesRate * 15) + (sleepRate * 15)
      )

      // Power users estimate — students likely to have all features active
      const powerUsersEstimate = Math.round(total * lmsRate * socialRate * teamRate)

      setData({
        totalStudents:    total,
        lmsConnected:     lmsConnectedCount,
        lmsConnectionRate: Math.round(lmsRate * 100),
        withContacts:     contactCount,
        socialRate:       Math.round(socialRate * 100),
        inTeams:          teamCount,
        teamRate:         Math.round(teamRate * 100),
        withActivities:   activitiesCount,
        activitiesRate:   Math.round(activitiesRate * 100),
        withSleep:        sleepCount,
        sleepRate:        Math.round(sleepRate * 100),
        avgDataDepth,
        uniBreakdown,
        sessionBreakdown,
        powerUsersEstimate,
      })
    } catch {
      setError('Could not load analytics. Check Supabase connection.')
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="grid grid-cols-5 gap-4 mb-6">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-24 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error} <button onClick={loadAnalytics} className="ml-2 underline">Retry</button>
        </div>
      </div>
    )
  }

  const maxUniCount = Math.max(...(data?.uniBreakdown.map(u => u.count) || [1]))
  const maxSession  = Math.max(...(data?.sessionBreakdown.map(s => s.count) || [1]))

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">User Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">Anonymised cohort data — no individual student identifiers</p>
        </div>
        <button onClick={loadAnalytics}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm transition-colors">
          <RefreshCw className="w-4 h-4" />Refresh
        </button>
      </div>

      {/* ── Acquisition headline metric ── */}
      <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-xl p-5 mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-green-400 uppercase tracking-wider font-medium mb-1">
            Average Data Depth Score — Acquisition Headline Metric
          </p>
          <p className="text-4xl font-black text-white">
            {data?.avgDataDepth || 0}<span className="text-xl text-gray-400">/100</span>
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Average richness of student profile across all {data?.totalStudents} students
          </p>
        </div>
        <div className="w-24 h-24 rounded-full border-4 border-green-500/30 flex items-center justify-center">
          <span className="text-2xl font-black text-green-400">{data?.avgDataDepth || 0}</span>
        </div>
      </div>

      {/* ── Feature adoption rates ── */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <Metric label="Total Students"  value={data?.totalStudents || 0}           colorClass="text-white" />
        <Metric label="LMS Connected"   value={`${data?.lmsConnectionRate || 0}%`} sub={`${data?.lmsConnected} students`}    colorClass="text-green-400" />
        <Metric label="Social Adoption" value={`${data?.socialRate || 0}%`}        sub={`${data?.withContacts} with contacts`} colorClass="text-blue-400" />
        <Metric label="Team Adoption"   value={`${data?.teamRate || 0}%`}          sub={`${data?.inTeams} in teams`}          colorClass="text-purple-400" />
        <Metric label="Sleep Set"       value={`${data?.sleepRate || 0}%`}         sub={`${data?.withSleep} students`}        colorClass="text-yellow-400" />
      </div>

      {/* ── Feature adoption funnel ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-white mb-4">Feature Adoption Funnel</h2>
        <div className="space-y-3">
          {[
            { label: 'Signed up',          value: data?.totalStudents || 0,  pct: 100 },
            { label: 'LMS connected',      value: data?.lmsConnected || 0,   pct: data?.lmsConnectionRate || 0 },
            { label: 'Added contact',      value: data?.withContacts || 0,   pct: data?.socialRate || 0 },
            { label: 'Joined a team',      value: data?.inTeams || 0,        pct: data?.teamRate || 0 },
            { label: 'Set activities',     value: data?.withActivities || 0, pct: data?.activitiesRate || 0 },
            { label: 'Set sleep schedule', value: data?.withSleep || 0,      pct: data?.sleepRate || 0 },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center gap-4">
              <span className="text-xs text-gray-600 w-4 shrink-0">{i + 1}</span>
              <p className="text-xs text-gray-400 w-40 shrink-0">{step.label}</p>
              <div className="flex-1 h-6 bg-gray-800 rounded-lg overflow-hidden">
                <div
                  className="h-full bg-green-500/50 rounded-lg flex items-center px-2 transition-all"
                  style={{ width: `${Math.max(step.pct, 2)}%` }}>
                  <span className="text-[10px] text-green-300 font-medium whitespace-nowrap">{step.pct}%</span>
                </div>
              </div>
              <span className="text-xs text-gray-400 w-12 text-right shrink-0">{step.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">

        {/* ── University breakdown ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Students by University</h2>
          <p className="text-xs text-gray-500 mb-4">Anonymised — university names only</p>
          {data?.uniBreakdown && data.uniBreakdown.length > 0 ? (
            <BarChart
              data={data.uniBreakdown.map(u => ({ label: u.university, value: u.count }))}
              max={maxUniCount}
            />
          ) : (
            <p className="text-gray-500 text-sm text-center py-6">No data yet</p>
          )}
        </div>

        {/* ── Session distribution ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Session Count Distribution</h2>
          <p className="text-xs text-gray-500 mb-4">How many times students have opened the app</p>
          {data?.sessionBreakdown && (
            <BarChart
              data={data.sessionBreakdown.map(s => ({ label: s.session, value: s.count }))}
              max={maxSession}
            />
          )}
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-500">
              Students on session 3+ see the upgrade banner. Power users estimated:{' '}
              <span className="text-white font-medium">{data?.powerUsersEstimate || 0}</span>
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}