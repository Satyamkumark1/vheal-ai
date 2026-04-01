import { useState, useCallback } from 'react'
import { api } from '../api/client'
import { usePolling } from '../hooks/usePolling'
import LiveBill from '../components/LiveBill'
import TestTracker from '../components/TestTracker'
import RightsPanel from '../components/RightsPanel'
import DisputeModal from '../components/DisputeModal'

const STEPS = [
  { key: 'Nursing', label: 'Clinical Clearance', icon: '🩺' },
  { key: 'Pharmacy', label: 'Pharmacy', icon: '💊' },
  { key: 'Billing', label: 'Final Bill', icon: '💰' },
  { key: 'Housekeeping', label: 'Housekeeping', icon: '🧹' },
]

const TABS = [
  { id: 'overview',      label: 'Overview',        icon: '🏠' },
  { id: 'bill',          label: 'My Bill',          icon: '💰' },
  { id: 'tests',         label: 'Tests & Medicines', icon: '🧪' },
  { id: 'disputes',      label: 'Disputes',         icon: '⚖️' },
  { id: 'rights',        label: 'My Rights',        icon: '🛡️' },
  { id: 'notifications', label: 'Notifications',    icon: '🔔' },
]

const NOTIFICATION_ICONS = {
  fraud_alert: '🚨',
  rights_info: '⚖️',
  bill_update: '💰',
  test_ordered: '🧪',
}

const STATE_STYLE = {
  ADMITTED: { badge: 'badge-admitted', dot: 'bg-blue-400' },
  READY_SOON: { badge: 'badge-ready-soon', dot: 'bg-amber-400' },
  READY: { badge: 'badge-ready-soon', dot: 'bg-amber-400' },
  DISCHARGING: { badge: 'badge-discharging', dot: 'bg-purple-400' },
  DISCHARGED: { badge: 'badge-discharged', dot: 'bg-emerald-400' },
}

export default function PatientPortal({ user }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [showDispute, setShowDispute] = useState(null)
  const fetchPortal = useCallback(() => api.patientPortal(), [])
  const { data, loading, refetch, secondsAgo } = usePolling(fetchPortal)

  if (loading && !data) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-vheal-500/30 border-t-vheal-500 rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading your health record…</p>
      </div>
    </div>
  )
  if (!data) return (
    <div className="flex-1 p-6">
      <div className="card text-center py-20 text-gray-500">Unable to load patient portal</div>
    </div>
  )

  const { patient, discharge_tasks, test_orders, medicines, bill, fraud_flags, disputes, rights, govt_schemes, dispute_options, notifications } = data

  const taskMap = {}
  discharge_tasks?.forEach(t => { taskMap[t.department] = t })

  const openFlags = fraud_flags?.filter(f => f.status === 'open') || []
  const stateStyle = STATE_STYLE[patient.state] || STATE_STYLE.ADMITTED
  const unreadCount = notifications?.filter(n => !n.is_read).length || 0
  const totalBill = bill?.items?.reduce((s, i) => s + i.total_price, 0) || bill?.total_amount || 0
  const disputedCount = disputes?.filter(d => d.status === 'open').length || 0

  const completedSteps = STEPS.filter(s => taskMap[s.key]?.status === 'complete').length
  const dischargeProgress = Math.round((completedSteps / STEPS.length) * 100)

  return (
    <div className="flex-1 overflow-auto">

      {/* ── HEADER ── */}
      <div className="sticky top-0 z-20 bg-surface-900/95 backdrop-blur border-b border-white/5">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-vheal-600/20 border border-vheal-500/30 flex items-center justify-center text-2xl">👤</div>
            <div>
              <h1 className="text-xl font-bold text-white">{patient.name}</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {patient.diagnosis} <span className="text-gray-600">·</span> Day {patient.current_day} <span className="text-gray-600">·</span> {patient.ward_type ? patient.ward_type.charAt(0).toUpperCase() + patient.ward_type.slice(1) : ''} Ward
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {secondsAgo !== null && (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live · {secondsAgo}s ago
              </p>
            )}
            <span className={`badge text-sm px-4 py-1.5 ${stateStyle.badge}`}>{patient.state}</span>
          </div>
        </div>

        {/* ── STAT STRIP ── */}
        <div className="px-6 pb-3 grid grid-cols-4 gap-3">
          {[
            { label: 'Total Bill', value: `₹${totalBill.toLocaleString()}`, color: 'text-blue-400', icon: '💳' },
            { label: 'Open Alerts', value: openFlags.length, color: openFlags.length > 0 ? 'text-red-400' : 'text-emerald-400', icon: openFlags.length > 0 ? '🚨' : '✅' },
            { label: 'Discharge', value: `${dischargeProgress}%`, color: dischargeProgress === 100 ? 'text-emerald-400' : 'text-purple-400', icon: '🚪' },
            { label: 'Disputes', value: disputedCount, color: disputedCount > 0 ? 'text-amber-400' : 'text-gray-400', icon: '⚖️' },
          ].map((s, i) => (
            <div key={i} className="bg-surface-800 border border-white/5 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <span className="text-xl">{s.icon}</span>
              <div>
                <div className={`text-lg font-bold leading-tight ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── TABS ── */}
        <div className="px-6 pb-3 flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${activeTab === t.id ? 'bg-vheal-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              {t.icon} {t.label}
              {t.id === 'notifications' && unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── FRAUD ALERT BANNER (global) ── */}
      {openFlags.length > 0 && (
        <div className="mx-6 mt-4 bg-red-500/10 border border-red-500/30 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 bg-red-500/5 border-b border-red-500/20">
            <span className="text-xl">🚨</span>
            <span className="text-red-400 font-bold text-sm">{openFlags.length} Billing Issue{openFlags.length > 1 ? 's' : ''} Detected — Your rights are protected</span>
          </div>
          <div className="divide-y divide-white/5">
            {openFlags.map(f => (
              <div key={f.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                <span className={`badge text-[10px] mt-0.5 badge-${f.severity} shrink-0`}>{f.severity}</span>
                <span className="text-gray-300">{f.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB CONTENT ── */}
      <div className="px-6 py-5 space-y-5 animate-fade-in">

        {/* ═══ OVERVIEW ═══ */}
        {activeTab === 'overview' && (
          <div className="space-y-5">

            {/* Patient Info Card */}
            <div className="card overflow-hidden">
              <div className="px-1 pb-4">
                <h2 className="section-title">Patient Information</h2>
              </div>
              <div className="bg-surface-900/50 rounded-xl border border-white/5 divide-y divide-white/5">
                {[
                  { label: 'Full Name', value: patient.name },
                  { label: 'Diagnosis', value: `${patient.diagnosis} (${patient.diagnosis_code})` },
                  { label: 'Bed / Ward', value: `Bed ${patient.bed_number || '—'} · ${patient.ward_type || '—'} Ward` },
                  { label: 'Admitted On', value: patient.admitted_at ? new Date(patient.admitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
                  { label: 'Day in Hospital', value: `Day ${patient.current_day}` },
                  { label: 'Doctor', value: patient.doctor_name || '—' },
                  { label: 'Insurance', value: patient.insurance_provider ? `${patient.insurance_provider} (${patient.insurance_id || 'No ID'})` : 'None' },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold w-36 shrink-0">{row.label}</span>
                    <span className="text-sm text-white font-medium flex-1 text-right">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Discharge Pipeline */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-title mb-0">Discharge Pipeline</h2>
                <span className={`text-sm font-bold ${dischargeProgress === 100 ? 'text-emerald-400' : 'text-purple-400'}`}>{dischargeProgress}% Complete</span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-surface-700 rounded-full mb-5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all duration-700 ${dischargeProgress === 100 ? 'bg-emerald-500' : 'bg-vheal-500'}`}
                  style={{ width: `${dischargeProgress}%` }}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {STEPS.map(step => {
                  const task = taskMap[step.key]
                  const completed = task?.status === 'complete'
                  const pending = task?.status === 'pending'
                  return (
                    <div key={step.key} className={`rounded-xl border p-4 transition-all ${completed ? 'bg-emerald-500/10 border-emerald-500/30' : pending ? 'bg-vheal-600/10 border-vheal-500/30' : 'bg-surface-700 border-white/5'}`}>
                      <div className="text-2xl mb-2">{completed ? '✅' : pending ? step.icon : '⬜'}</div>
                      <p className={`text-sm font-semibold ${completed ? 'text-emerald-400' : pending ? 'text-vheal-300' : 'text-gray-500'}`}>{step.label}</p>
                      <p className="text-[10px] text-gray-600 mt-1">{completed ? `Done · ${task.completed_at ? new Date(task.completed_at).toLocaleTimeString() : ''}` : pending ? 'In Progress' : 'Pending'}</p>
                    </div>
                  )
                })}
              </div>

              {patient.state === 'DISCHARGED' && (
                <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
                  <span className="text-3xl">🎉</span>
                  <p className="text-emerald-400 font-bold mt-2">You have been discharged. Thank you!</p>
                </div>
              )}
            </div>

            {/* Summary of bill + alerts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="card cursor-pointer hover:border-blue-500/30 transition-colors border border-white/5" onClick={() => setActiveTab('bill')}>
                <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Current Bill Total</p>
                <p className="text-3xl font-bold text-blue-400">₹{totalBill.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-2">Click to view full bill →</p>
              </div>
              <div className={`card cursor-pointer transition-colors border ${openFlags.length > 0 ? 'border-red-500/30 hover:border-red-500/50' : 'border-white/5 hover:border-emerald-500/30'}`} onClick={() => setActiveTab('disputes')}>
                <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Billing Protection</p>
                <p className={`text-3xl font-bold ${openFlags.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{openFlags.length > 0 ? `${openFlags.length} Issue${openFlags.length > 1 ? 's' : ''}` : 'All Clear'}</p>
                <p className="text-xs text-gray-500 mt-2">{openFlags.length > 0 ? 'Tap to raise a dispute →' : 'No billing issues found'}</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══ BILL ═══ */}
        {activeTab === 'bill' && (
          <LiveBill bill={bill} fraudFlags={fraud_flags} onDispute={item => setShowDispute(item)} />
        )}

        {/* ═══ TESTS & MEDICINES ═══ */}
        {activeTab === 'tests' && (
          <div className="space-y-5">
            <TestTracker tests={test_orders} protocol={data.protocol} />

            {/* Medicines */}
            {medicines?.length > 0 ? (
              <div className="card">
                <h2 className="section-title">💊 Medicines Dispensed</h2>
                <div className="bg-surface-900/50 rounded-xl border border-white/5 divide-y divide-white/5 overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-4 px-4 py-2 text-xs text-gray-500 uppercase tracking-wide font-semibold bg-surface-800">
                    <span>Medicine</span>
                    <span className="text-center">Qty</span>
                    <span className="text-right">NPPA Ceiling</span>
                    <span className="text-right">Charged</span>
                  </div>
                  {medicines.map((m, i) => (
                    <div key={i} className={`grid grid-cols-4 items-center px-4 py-3 ${m.overcharge_flag ? 'bg-red-500/5' : 'hover:bg-white/5'} transition-colors`}>
                      <div>
                        <span className="text-white font-medium text-sm">{m.name}</span>
                        {m.is_private_label && <span className="badge badge-medium text-[10px] ml-2">Private Label</span>}
                        {m.generic_alternative_name && (
                          <p className="text-blue-400 text-[10px] mt-0.5">Alt: {m.generic_alternative_name} (₹{m.generic_price})</p>
                        )}
                      </div>
                      <span className="text-gray-400 text-sm text-center">× {m.quantity}</span>
                      <span className="text-emerald-400 font-mono text-sm text-right">₹{m.nppa_ceiling_price || '—'}</span>
                      <div className="text-right">
                        <span className={`font-mono text-sm ${m.overcharge_flag ? 'text-red-400 font-bold' : 'text-white'}`}>₹{m.unit_price_charged}</span>
                        {m.overcharge_flag && (
                          <button onClick={() => setShowDispute({ item_name: m.name, id: null })} className="block text-[10px] text-red-400 hover:underline mt-0.5 ml-auto">Dispute →</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {medicines.some(m => m.overcharge_flag) && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-red-400">
                    <span>🚨</span>
                    <span>Red items are charged above NPPA ceiling price. You can dispute these charges.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="card text-center py-10 text-gray-500">No medicines dispensed yet</div>
            )}
          </div>
        )}

        {/* ═══ DISPUTES ═══ */}
        {activeTab === 'disputes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="section-title mb-0">Your Disputes</h2>
              <button onClick={() => setShowDispute({ item_name: 'General Dispute', id: null })} className="btn-primary text-sm px-4 py-2">
                + Raise New Dispute
              </button>
            </div>

            {disputes?.length > 0 ? (
              <div className="space-y-3">
                {disputes.map(d => (
                  <div key={d.id} className={`card border ${d.status === 'open' ? 'border-amber-500/20' : d.status === 'resolved' ? 'border-emerald-500/20' : 'border-white/5'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-semibold text-sm">{d.item_name || d.plain_language_name || 'General Dispute'}</span>
                          <span className={`badge text-[10px] ${d.status === 'resolved' ? 'badge-discharged' : d.status === 'open' ? 'badge-admitted' : 'badge-ready-soon'}`}>{d.status}</span>
                        </div>
                        <p className="text-gray-400 text-xs">{d.description}</p>
                        {d.resolution_note && (
                          <p className="text-gray-500 text-xs mt-2 border-t border-white/5 pt-2">
                            <span className="text-gray-400 font-medium">Resolution:</span> {d.resolution_note}
                          </p>
                        )}
                      </div>
                      {d.refund_amount > 0 && (
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-gray-500">Refund</p>
                          <p className="text-emerald-400 font-bold font-mono">₹{d.refund_amount}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card text-center py-16">
                <p className="text-4xl mb-3">⚖️</p>
                <p className="text-gray-400 font-medium">No disputes raised yet</p>
                <p className="text-gray-600 text-sm mt-1">If you feel any charge is wrong, you can raise a dispute</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ RIGHTS ═══ */}
        {activeTab === 'rights' && (
          <RightsPanel rights={rights} govtSchemes={govt_schemes} />
        )}

        {/* ═══ NOTIFICATIONS ═══ */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="section-title mb-0">Notifications</h2>
              {unreadCount > 0 && <span className="text-xs text-gray-500">{unreadCount} unread</span>}
            </div>

            {notifications?.length > 0 ? (
              <div className="space-y-2">
                {notifications.map(n => (
                  <div key={n.id} className={`flex items-start gap-4 px-4 py-3 rounded-2xl border transition-colors ${n.is_read ? 'bg-surface-800/50 border-transparent' : 'bg-surface-800 border-white/5'}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${n.type === 'fraud_alert' ? 'bg-red-500/10' : n.type === 'bill_update' ? 'bg-blue-500/10' : n.type === 'rights_info' ? 'bg-amber-500/10' : 'bg-surface-700'}`}>
                      {NOTIFICATION_ICONS[n.type] || '🔔'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${n.is_read ? 'text-gray-400' : 'text-white'}`}>{n.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{n.message}</p>
                    </div>
                    <span className="text-gray-600 text-[10px] shrink-0 mt-1">{new Date(n.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card text-center py-16">
                <p className="text-4xl mb-3">🔔</p>
                <p className="text-gray-400">No notifications yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── DISPUTE MODAL ── */}
      {showDispute && (
        <DisputeModal
          item={showDispute}
          options={dispute_options}
          onClose={() => setShowDispute(null)}
          onSubmit={async (formData) => {
            await api.fileDispute({ bill_item_id: showDispute.id, ...formData })
            setShowDispute(null)
            refetch()
          }}
        />
      )}
    </div>
  )
}
