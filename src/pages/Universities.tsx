// src/pages/Universities.tsx
//
// PURPOSE: University Registry Manager — most used admin section.
// Allows viewing, editing, activating, and adding universities.
// All changes are written to university_registry table and logged
// to admin_audit_log for compliance tracking.
//
// READS FROM:  university_registry, profiles (student count per uni)
// WRITES TO:   university_registry, admin_audit_log
// MOATS:       Academic Identity Graph, Transition Layer, University Staff Relationship

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, CheckCircle2, XCircle, Edit2, Check, X, Plus, RefreshCw } from 'lucide-react'

interface University {
  domain: string
  name: string
  country: string | null
  lms_type: string | null
  lms_instance_url: string | null
  email_system: string | null
  calendar_type: string | null
  is_active: boolean
  studentCount?: number
}

// Country filter options
const COUNTRIES = ['All', 'UK', 'US', 'CA', 'AU', 'EU', 'OTHER']
const LMS_TYPES = ['All', 'moodle', 'canvas', 'blackboard', 'd2l', 'unknown']

export default function Universities() {
  const [universities, setUniversities] = useState<University[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [countryFilter, setCountryFilter] = useState('All')
  const [lmsFilter,    setLmsFilter]    = useState('All')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'pending'>('all')
  const [editingDomain, setEditingDomain] = useState<string | null>(null)
  const [editForm,     setEditForm]     = useState<Partial<University>>({})
  const [saving,       setSaving]       = useState(false)
  const [showAddForm,  setShowAddForm]  = useState(false)
  const [newUni,       setNewUni]       = useState({ domain: '', name: '', country: 'UK', lms_type: 'moodle', lms_instance_url: '', email_system: 'microsoft', calendar_type: 'outlook' })
  const [adding,       setAdding]       = useState(false)

  useEffect(() => { loadUniversities() }, [])

  const loadUniversities = async () => {
    setLoading(true)

    // Load universities + student count per domain in parallel
    const [uniRes, profilesRes] = await Promise.all([
      supabase.from('university_registry').select('*').order('country').order('name'),
      supabase.from('profiles').select('university'),
    ])

    // Count students per university name (anonymised — no student IDs)
    const counts: Record<string, number> = {}
    ;(profilesRes.data || []).forEach((p: any) => {
      if (p.university) counts[p.university] = (counts[p.university] || 0) + 1
    })

    const unis = (uniRes.data || []).map((u: any) => ({
      ...u,
      studentCount: counts[u.name] || 0,
    }))

    setUniversities(unis)
    setLoading(false)
  }

  // Filter universities based on search + filters
  const filtered = universities.filter(u => {
    const matchSearch  = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.domain.toLowerCase().includes(search.toLowerCase())
    const matchCountry = countryFilter === 'All' || u.country === countryFilter
    const matchLms     = lmsFilter === 'All' || u.lms_type === lmsFilter
    const matchActive  = activeFilter === 'all' || (activeFilter === 'active' ? u.is_active : !u.is_active)
    return matchSearch && matchCountry && matchLms && matchActive
  })

  // Save edited university — writes to registry + audit log
  const saveEdit = async (domain: string) => {
    setSaving(true)
    const original = universities.find(u => u.domain === domain)

    const { error } = await supabase
      .from('university_registry')
      .update(editForm)
      .eq('domain', domain)

    if (!error) {
      // Log the change to admin_audit_log for compliance
      await supabase.from('admin_audit_log').insert({
        action: 'UPDATE_UNIVERSITY',
        table_name: 'university_registry',
        record_id: domain,
        old_value: original,
        new_value: { ...original, ...editForm },
      })

      setUniversities(prev => prev.map(u => u.domain === domain ? { ...u, ...editForm } : u))
      setEditingDomain(null)
    }

    setSaving(false)
  }

  // Toggle university active status — with audit log
  const toggleActive = async (university: University) => {
    const newActive = !university.is_active
    const { error } = await supabase
      .from('university_registry')
      .update({ is_active: newActive })
      .eq('domain', university.domain)

    if (!error) {
      await supabase.from('admin_audit_log').insert({
        action: newActive ? 'ACTIVATE_UNIVERSITY' : 'DEACTIVATE_UNIVERSITY',
        table_name: 'university_registry',
        record_id: university.domain,
        old_value: { is_active: university.is_active },
        new_value: { is_active: newActive },
      })
      setUniversities(prev => prev.map(u => u.domain === university.domain ? { ...u, is_active: newActive } : u))
    }
  }

  // Add new university manually
  const addUniversity = async () => {
    if (!newUni.domain || !newUni.name) return
    setAdding(true)

    const { error } = await supabase.from('university_registry').insert({
      ...newUni,
      is_active: false,
      tld: newUni.domain.split('.').slice(-2).join('.'),
    })

    if (!error) {
      await supabase.from('admin_audit_log').insert({
        action: 'ADD_UNIVERSITY',
        table_name: 'university_registry',
        record_id: newUni.domain,
        new_value: newUni,
      })
      await loadUniversities()
      setShowAddForm(false)
      setNewUni({ domain: '', name: '', country: 'UK', lms_type: 'moodle', lms_instance_url: '', email_system: 'microsoft', calendar_type: 'outlook' })
    }

    setAdding(false)
  }

  const pendingCount = universities.filter(u => !u.is_active).length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Universities</h1>
          <p className="text-gray-400 text-sm mt-1">
            {universities.length} total · {pendingCount} pending activation
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadUniversities} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm transition-colors">
            <RefreshCw className="w-4 h-4" />Refresh
          </button>
          <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black px-3 py-2 rounded-lg text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" />Add University
          </button>
        </div>
      </div>

      {/* Add university form */}
      {showAddForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 grid grid-cols-4 gap-3">
          <input placeholder="domain (e.g. essex.ac.uk)" value={newUni.domain} onChange={e => setNewUni(p => ({ ...p, domain: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500" />
          <input placeholder="University name" value={newUni.name} onChange={e => setNewUni(p => ({ ...p, name: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500" />
          <input placeholder="LMS instance URL" value={newUni.lms_instance_url} onChange={e => setNewUni(p => ({ ...p, lms_instance_url: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500" />
          <div className="flex gap-2">
            <select value={newUni.country} onChange={e => setNewUni(p => ({ ...p, country: e.target.value }))}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
              {['UK','US','CA','AU','EU','OTHER'].map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={newUni.lms_type} onChange={e => setNewUni(p => ({ ...p, lms_type: e.target.value }))}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
              {['moodle','canvas','blackboard','d2l','unknown'].map(t => <option key={t}>{t}</option>)}
            </select>
            <select value={newUni.email_system} onChange={e => setNewUni(p => ({ ...p, email_system: e.target.value }))}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
              {['microsoft','google','unknown'].map(s => <option key={s}>{s}</option>)}
            </select>
            <button onClick={addUniversity} disabled={adding || !newUni.domain || !newUni.name}
              className="bg-green-500 hover:bg-green-400 text-black px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors">
              {adding ? '...' : 'Add'}
            </button>
            <button onClick={() => setShowAddForm(false)} className="bg-gray-800 text-gray-400 px-3 py-2 rounded-lg text-sm">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search universities..."
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
        <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
          {COUNTRIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={lmsFilter} onChange={e => setLmsFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
          {LMS_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <div className="flex bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          {(['all', 'active', 'pending'] as const).map(f => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className={`px-3 py-2 text-sm capitalize transition-colors ${activeFilter === f ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:text-white'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-gray-900 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">University</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Domain</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Country</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">LMS</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Students</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map(uni => (
                <tr key={uni.domain} className="hover:bg-gray-800/50 transition-colors">
                  {editingDomain === uni.domain ? (
                    // Inline edit row
                    <>
                      <td className="px-4 py-2">
                        <input value={editForm.name || ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white w-full focus:outline-none focus:ring-1 focus:ring-green-500" />
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-xs">{uni.domain}</td>
                      <td className="px-4 py-2">
                        <select value={editForm.country || ''} onChange={e => setEditForm(p => ({ ...p, country: e.target.value }))}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none">
                          {['UK','US','CA','AU','EU','OTHER'].map(c => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <select value={editForm.lms_type || ''} onChange={e => setEditForm(p => ({ ...p, lms_type: e.target.value }))}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none">
                          {['moodle','canvas','blackboard','d2l','unknown'].map(t => <option key={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <select value={editForm.email_system || ''} onChange={e => setEditForm(p => ({ ...p, email_system: e.target.value }))}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none">
                          {['microsoft','google','unknown'].map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2 text-gray-400">{uni.studentCount}</td>
                      <td className="px-4 py-2" />
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <button onClick={() => saveEdit(uni.domain)} disabled={saving}
                            className="w-7 h-7 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center hover:bg-green-500/30 transition-colors">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditingDomain(null)}
                            className="w-7 h-7 rounded-lg bg-gray-800 text-gray-400 flex items-center justify-center hover:bg-gray-700 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    // Display row
                    <>
                      <td className="px-4 py-3 text-white font-medium">{uni.name}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs font-mono">{uni.domain}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">{uni.country || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          uni.lms_type === 'moodle'     ? 'bg-blue-500/10 text-blue-400' :
                          uni.lms_type === 'canvas'     ? 'bg-purple-500/10 text-purple-400' :
                          uni.lms_type === 'blackboard' ? 'bg-orange-500/10 text-orange-400' :
                          uni.lms_type === 'd2l'        ? 'bg-yellow-500/10 text-yellow-400' :
                          'bg-gray-800 text-gray-500'
                        }`}>{uni.lms_type || 'unknown'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          uni.email_system === 'microsoft' ? 'bg-blue-500/10 text-blue-400' :
                          uni.email_system === 'google'    ? 'bg-red-500/10 text-red-400' :
                          'bg-gray-800 text-gray-500'
                        }`}>{uni.email_system || 'unknown'}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{uni.studentCount || 0}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleActive(uni)}
                          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium transition-colors ${
                            uni.is_active
                              ? 'bg-green-500/10 text-green-400 hover:bg-red-500/10 hover:text-red-400'
                              : 'bg-yellow-500/10 text-yellow-400 hover:bg-green-500/10 hover:text-green-400'
                          }`}>
                          {uni.is_active
                            ? <><CheckCircle2 className="w-3 h-3" />Active</>
                            : <><XCircle className="w-3 h-3" />Pending</>}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => { setEditingDomain(uni.domain); setEditForm(uni) }}
                          className="w-7 h-7 rounded-lg bg-gray-800 text-gray-400 flex items-center justify-center hover:bg-gray-700 hover:text-white transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-500 text-sm">No universities match your filters</div>
          )}
        </div>
      )}
    </div>
  )
}
