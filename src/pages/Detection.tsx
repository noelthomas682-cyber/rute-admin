// src/pages/Detection.tsx
//
// PURPOSE: Detection Monitor — real-time queue of universities pending review.
// Shows all university_registry entries where is_active = false.
// These are either auto-detected by the detect-lms Edge Function
// or manually submitted by students during onboarding.
//
// READS FROM:  university_registry (Supabase — realtime subscription)
// WRITES TO:   university_registry, admin_audit_log
//
// MOATS VISIBLE:
//   - Transition Layer — flywheel speed (how fast unknown unis become known)
//   - Academic Identity Graph — expansion rate
//
// REALTIME: Supabase subscription updates the queue live when new
// universities are detected — no manual refresh needed.

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  CheckCircle2, XCircle, Edit2, Check, X,
  RefreshCw, Clock, Radar, ChevronDown, ChevronUp,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingUniversity {
  domain: string
  name: string | null
  country: string | null
  lms_type: string | null
  lms_instance_url: string | null
  email_system: string | null
  calendar_type: string | null
  is_active: boolean
  created_at: string | null
  tld: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeSince(dateStr: string | null): string {
  if (!dateStr) return 'Unknown'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function confidenceScore(uni: PendingUniversity): number {
  // Score 0-100 based on how much data was detected
  let score = 0
  if (uni.lms_type    && uni.lms_type    !== 'unknown') score += 40
  if (uni.lms_instance_url)                              score += 30
  if (uni.email_system && uni.email_system !== 'unknown') score += 20
  if (uni.country)                                        score += 10
  return score
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Detection() {
  const [pending,      setPending]      = useState<PendingUniversity[]>([])
  const [loading,      setLoading]      = useState(true)
  const [editingDomain, setEditingDomain] = useState<string | null>(null)
  const [editForm,     setEditForm]     = useState<Partial<PendingUniversity>>({})
  const [saving,       setSaving]       = useState(false)
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null)

  useEffect(() => {
    loadPending()

    // Realtime subscription — updates queue when new universities are detected
    // detect-lms Edge Function writes to university_registry with is_active: false
    // This subscription fires when that happens — queue updates live
    const channel = supabase
      .channel('detection-queue')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'university_registry',
      }, () => {
        // Reload on any change to the registry
        loadPending()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Load all universities pending activation (is_active = false)
  // Ordered by most recently created — newest detections first
  const loadPending = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('university_registry')
      .select('*')
      .eq('is_active', false)
      .order('created_at', { ascending: false })

    if (!error) setPending(data as PendingUniversity[] || [])
    setLoading(false)
  }

  // Activate a university — sets is_active: true and logs the action
  const activate = async (uni: PendingUniversity) => {
    const { error } = await supabase
      .from('university_registry')
      .update({ is_active: true })
      .eq('domain', uni.domain)

    if (!error) {
      // Log activation to admin_audit_log for compliance
      await supabase.from('admin_audit_log').insert({
        action: 'ACTIVATE_UNIVERSITY',
        table_name: 'university_registry',
        record_id: uni.domain,
        old_value: { is_active: false },
        new_value: { is_active: true },
      })
      setPending(prev => prev.filter(u => u.domain !== uni.domain))
    }
  }

  // Reject/delete a pending university — removes from registry entirely
  const reject = async (domain: string) => {
    const { error } = await supabase
      .from('university_registry')
      .delete()
      .eq('domain', domain)

    if (!error) {
      await supabase.from('admin_audit_log').insert({
        action: 'REJECT_UNIVERSITY',
        table_name: 'university_registry',
        record_id: domain,
      })
      setPending(prev => prev.filter(u => u.domain !== domain))
    }
  }

  // Save inline edits before activating
  const saveEdit = async (domain: string) => {
    setSaving(true)
    const { error } = await supabase
      .from('university_registry')
      .update(editForm)
      .eq('domain', domain)

    if (!error) {
      await supabase.from('admin_audit_log').insert({
        action: 'EDIT_PENDING_UNIVERSITY',
        table_name: 'university_registry',
        record_id: domain,
        new_value: editForm,
      })
      setPending(prev => prev.map(u => u.domain === domain ? { ...u, ...editForm } : u))
      setEditingDomain(null)
    }
    setSaving(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Detection Monitor</h1>
          <p className="text-gray-400 text-sm mt-1">
            Universities auto-detected or submitted by students — pending your review
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live indicator — shows realtime subscription is active */}
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Live
          </div>
          <button
            onClick={loadPending}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm transition-colors">
            <RefreshCw className="w-4 h-4" />Refresh
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Pending Review',  value: pending.length,                                             color: 'text-yellow-400' },
          { label: 'High Confidence', value: pending.filter(u => confidenceScore(u) >= 70).length,       color: 'text-green-400'  },
          { label: 'Partial Data',    value: pending.filter(u => confidenceScore(u) > 0 && confidenceScore(u) < 70).length, color: 'text-blue-400' },
          { label: 'No Data',         value: pending.filter(u => confidenceScore(u) === 0).length,       color: 'text-red-400'    },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Pending queue ── */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-900 rounded-xl animate-pulse" />)}
        </div>
      ) : pending.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <Radar className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">Queue is empty</p>
          <p className="text-gray-500 text-sm">New universities will appear here when students from unknown institutions sign up</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map(uni => {
            const score    = confidenceScore(uni)
            const isEditing = editingDomain === uni.domain
            const isExpanded = expandedDomain === uni.domain

            return (
              <div key={uni.domain} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">

                {/* ── Main row ── */}
                <div className="p-4 flex items-center gap-4">

                  {/* Confidence score indicator */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold ${
                    score >= 70 ? 'bg-green-500/10 text-green-400' :
                    score > 0   ? 'bg-yellow-500/10 text-yellow-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>
                    {score}%
                  </div>

                  {/* University info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-white text-sm truncate">
                        {uni.name || uni.domain}
                      </p>
                      {uni.country && (
                        <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded shrink-0">
                          {uni.country}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 font-mono">{uni.domain}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {uni.lms_type && uni.lms_type !== 'unknown' && (
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded capitalize">{uni.lms_type}</span>
                      )}
                      {uni.email_system && uni.email_system !== 'unknown' && (
                        <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded capitalize">{uni.email_system}</span>
                      )}
                      {uni.lms_instance_url && (
                        <span className="text-[10px] text-gray-500 font-mono truncate max-w-xs">{uni.lms_instance_url}</span>
                      )}
                    </div>
                  </div>

                  {/* Time since detection */}
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {timeSince(uni.created_at)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Expand for full details */}
                    <button
                      onClick={() => setExpandedDomain(isExpanded ? null : uni.domain)}
                      className="w-8 h-8 rounded-lg bg-gray-800 text-gray-400 flex items-center justify-center hover:bg-gray-700 transition-colors">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {/* Edit */}
                    <button
                      onClick={() => { setEditingDomain(uni.domain); setEditForm(uni); setExpandedDomain(uni.domain) }}
                      className="w-8 h-8 rounded-lg bg-gray-800 text-gray-400 flex items-center justify-center hover:bg-gray-700 hover:text-white transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {/* Reject */}
                    <button
                      onClick={() => reject(uni.domain)}
                      className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors">
                      <XCircle className="w-4 h-4" />
                    </button>
                    {/* Activate */}
                    <button
                      onClick={() => activate(uni)}
                      className="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 text-black px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                      <CheckCircle2 className="w-3.5 h-3.5" />Activate
                    </button>
                  </div>
                </div>

                {/* ── Expanded detail / edit row ── */}
                {isExpanded && (
                  <div className="border-t border-gray-800 p-4 bg-gray-950">
                    {isEditing ? (
                      // Edit form
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="text-[10px] text-gray-500 uppercase tracking-wider">Name</label>
                          <input
                            value={editForm.name || ''}
                            onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white mt-1 focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 uppercase tracking-wider">LMS Type</label>
                          <select
                            value={editForm.lms_type || ''}
                            onChange={e => setEditForm(p => ({ ...p, lms_type: e.target.value }))}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white mt-1 focus:outline-none">
                            {['moodle','canvas','blackboard','d2l','unknown'].map(t => <option key={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 uppercase tracking-wider">LMS Instance URL</label>
                          <input
                            value={editForm.lms_instance_url || ''}
                            onChange={e => setEditForm(p => ({ ...p, lms_instance_url: e.target.value }))}
                            placeholder="https://moodle.university.ac.uk"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white mt-1 focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 uppercase tracking-wider">Email System</label>
                          <select
                            value={editForm.email_system || ''}
                            onChange={e => setEditForm(p => ({ ...p, email_system: e.target.value }))}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white mt-1 focus:outline-none">
                            {['microsoft','google','unknown'].map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                        <div className="col-span-4 flex justify-end gap-2 mt-2">
                          <button
                            onClick={() => setEditingDomain(null)}
                            className="flex items-center gap-1 bg-gray-800 text-gray-400 px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-gray-700">
                            <X className="w-3.5 h-3.5" />Cancel
                          </button>
                          <button
                            onClick={() => saveEdit(uni.domain)}
                            disabled={saving}
                            className="flex items-center gap-1 bg-green-500 hover:bg-green-400 text-black px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors">
                            <Check className="w-3.5 h-3.5" />Save changes
                          </button>
                          <button
                            onClick={async () => { await saveEdit(uni.domain); await activate(uni) }}
                            disabled={saving}
                            className="flex items-center gap-1 bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors">
                            <CheckCircle2 className="w-3.5 h-3.5" />Save & Activate
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Full detail view
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <p className="text-gray-500 uppercase tracking-wider text-[10px] mb-1">Detection details</p>
                          <p className="text-gray-300">Domain: <span className="text-white font-mono">{uni.domain}</span></p>
                          <p className="text-gray-300 mt-0.5">TLD: <span className="text-white">{uni.tld || '—'}</span></p>
                          <p className="text-gray-300 mt-0.5">Country: <span className="text-white">{uni.country || '—'}</span></p>
                        </div>
                        <div>
                          <p className="text-gray-500 uppercase tracking-wider text-[10px] mb-1">LMS data</p>
                          <p className="text-gray-300">Type: <span className="text-white capitalize">{uni.lms_type || '—'}</span></p>
                          <p className="text-gray-300 mt-0.5 break-all">URL: <span className="text-white font-mono">{uni.lms_instance_url || '—'}</span></p>
                        </div>
                        <div>
                          <p className="text-gray-500 uppercase tracking-wider text-[10px] mb-1">Email system</p>
                          <p className="text-gray-300">System: <span className="text-white capitalize">{uni.email_system || '—'}</span></p>
                          <p className="text-gray-300 mt-0.5">Calendar: <span className="text-white capitalize">{uni.calendar_type || '—'}</span></p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}