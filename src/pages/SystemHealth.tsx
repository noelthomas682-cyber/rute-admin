// src/pages/SystemHealth.tsx
//
// PURPOSE: Operational monitoring — cron jobs, DB table counts, Edge Function health.
// This is the "is everything working?" page — check before and after beta launch.
//
// READS FROM:
//   - cron.job (Supabase pg_cron — all scheduled jobs)
//   - information_schema (table row counts)
//   - Supabase Edge Function invocations (via management API)
//
// MOATS VISIBLE:
//   - Data Portability — system reliability
//   - Transition Layer — Edge Function health

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Activity } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CronJob {
  jobname: string
  schedule: string
  active: boolean
}

interface TableCount {
  table_name: string
  row_count: number
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SystemHealth() {
  const [cronJobs,    setCronJobs]    = useState<CronJob[]>([])
  const [tableCounts, setTableCounts] = useState<TableCount[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  useEffect(() => { loadSystemHealth() }, [])

  const loadSystemHealth = async () => {
    setLoading(true)
    setError(null)

    try {
      // Load cron jobs from pg_cron

      // Query cron jobs via RPC function (get_cron_jobs)
      // Direct cron.job table access is blocked by Supabase security
      // RPC uses security definer to bypass this
      const { data: jobs } = await supabase.rpc('get_cron_jobs')
      if (jobs) setCronJobs(jobs as CronJob[])

      // Get row counts for key tables
      const tables = [
        'profiles', 'university_registry', 'lms_connections',
        'contacts', 'teams', 'team_members', 'team_sessions',
        'session_rsvps', 'calendar_events', 'tasks', 'goals',
        'notifications', 'conversations', 'messages',
        'announcements', 'admin_audit_log',
      ]

      const counts = await Promise.all(
        tables.map(async (table) => {
          const { count } = await supabase
            .from(table as any)
            .select('*', { count: 'exact', head: true })
          return { table_name: table, row_count: count || 0 }
        })
      )

      setTableCounts(counts)
      setLastRefresh(new Date())
    } catch (err: any) {
      setError('Could not load system health data.')
    }

    setLoading(false)
  }

  // Group cron jobs by type
  const reminderJobs = cronJobs.filter(j =>
    j.jobname === 'class-reminders' || j.jobname === 'deadline-reminders'
  )
  const feedJobs = cronJobs.filter(j =>
    j.jobname !== 'class-reminders' && j.jobname !== 'deadline-reminders'
  )
  const activeJobs   = cronJobs.filter(j => j.active).length
  const inactiveJobs = cronJobs.filter(j => !j.active).length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">System Health</h1>
          <p className="text-gray-400 text-sm mt-1">
            Last refreshed: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={loadSystemHealth}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm transition-colors">
          <RefreshCw className="w-4 h-4" />Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {/* ── System status overview ── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-green-400">{activeJobs}</p>
          <p className="text-sm text-gray-400 mt-0.5">Active cron jobs</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className={`text-2xl font-bold ${inactiveJobs > 0 ? 'text-red-400' : 'text-gray-600'}`}>
            {inactiveJobs}
          </p>
          <p className="text-sm text-gray-400 mt-0.5">Inactive jobs</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-400">{tableCounts.length}</p>
          <p className="text-sm text-gray-400 mt-0.5">Tables monitored</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-purple-400">
            {tableCounts.reduce((sum, t) => sum + t.row_count, 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-400 mt-0.5">Total rows</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">

        {/* ── Critical cron jobs ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-400" />
            Critical Jobs
          </h2>
          {loading ? (
            <div className="space-y-2">
              {[1,2].map(i => <div key={i} className="h-10 bg-gray-800 rounded-lg animate-pulse" />)}
            </div>
          ) : reminderJobs.length === 0 ? (
            <div className="flex items-center gap-2 text-yellow-400 text-sm">
              <AlertTriangle className="w-4 h-4" />
              Critical jobs not found — check pg_cron setup
            </div>
          ) : (
            <div className="space-y-2">
              {reminderJobs.map(job => (
                <div key={job.jobname} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    {job.active
                      ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                      : <XCircle      className="w-4 h-4 text-red-400 shrink-0" />}
                    <p className="text-sm text-white font-medium">{job.jobname}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 font-mono">{job.schedule}</p>
                    <p className={`text-[10px] font-medium ${job.active ? 'text-green-400' : 'text-red-400'}`}>
                      {job.active ? 'Running' : 'Stopped'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── DB table counts ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Database Tables</h2>
          {loading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-gray-800 rounded animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {tableCounts
                .sort((a, b) => b.row_count - a.row_count)
                .map(t => (
                  <div key={t.table_name} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
                    <p className="text-xs text-gray-400 font-mono">{t.table_name}</p>
                    <p className="text-xs text-white font-medium">{t.row_count.toLocaleString()}</p>
                  </div>
                ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Feed fetch cron jobs ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">University Feed Jobs ({feedJobs.length})</h2>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="flex items-center gap-1 text-green-400">
              <CheckCircle2 className="w-3 h-3" />{feedJobs.filter(j => j.active).length} active
            </span>
            {feedJobs.filter(j => !j.active).length > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <XCircle className="w-3 h-3" />{feedJobs.filter(j => !j.active).length} inactive
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-4 gap-2">
            {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-8 bg-gray-800 rounded animate-pulse" />)}
          </div>
        ) : feedJobs.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
            No feed jobs found — cron.job table may not be accessible
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {feedJobs.map(job => (
              <div
                key={job.jobname}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                  job.active ? 'bg-green-500/5 border border-green-500/20' : 'bg-red-500/5 border border-red-500/20'
                }`}>
                {job.active
                  ? <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                  : <XCircle      className="w-3 h-3 text-red-400 shrink-0" />}
                <p className="text-gray-300 truncate">{job.jobname.replace('fetch-', '')}</p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}