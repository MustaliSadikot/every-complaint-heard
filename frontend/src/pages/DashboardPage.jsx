import React, { useState, useEffect } from 'react';
import { dashboardApi } from '../api';
import { StatCard, Spinner, UrgencyBadge } from '../components/ui';
import { URGENCY_COLORS, DEPARTMENT_ICONS } from '../utils';
import {
  BarChart, Bar, PieChart, Pie, Cell, Tooltip, ResponsiveContainer, XAxis, YAxis, Legend
} from 'recharts';
import {
  ClipboardList, AlertTriangle, ShieldAlert, Clock,
  TrendingUp, Cpu, RefreshCw, Wifi, WifiOff
} from 'lucide-react';

const DEPT_CHART_COLORS = [
  '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#64748b'
];

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.stats();
      setStats(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load stats', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  if (loading && !stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const deptData = (stats?.department_counts || []).map(d => ({
    name: d.department.split(' ')[0],
    fullName: d.department,
    count: d.count,
  }));

  const urgencyData = [
    { name: 'Critical', value: stats?.critical_count || 0, color: '#ef4444' },
    { name: 'High', value: stats?.high_count || 0, color: '#f97316' },
    { name: 'Medium', value: stats?.medium_count || 0, color: '#eab308' },
    { name: 'Low', value: stats?.low_count || 0, color: '#22c55e' },
  ].filter(d => d.value > 0);

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div className="page-title">
          <h1>Dashboard</h1>
          <div className="page-subtitle">
            Gujarat Metro Complaint Triage · Real-time Overview
            {lastUpdated && (
              <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                · Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* AI status indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 10,
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            fontSize: '0.8rem',
          }}>
            {stats?.ai_available ? (
              <><Cpu size={14} style={{ color: '#a5b4fc' }} /> <span style={{ color: '#a5b4fc', fontWeight: 600 }}>AI Active</span></>
            ) : (
              <><Cpu size={14} style={{ color: 'var(--brand-accent)' }} /> <span style={{ color: 'var(--brand-accent)', fontWeight: 600 }}>Fallback Mode</span></>
            )}
          </div>
          {/* Offline indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
            fontSize: '0.78rem', color: '#22c55e', fontWeight: 600,
          }}>
            <Wifi size={14} /> Offline Ready
          </div>
          <button className="btn btn-ghost btn-sm" onClick={load} id="dashboard-refresh-btn">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Safety alert banner if any critical/safety items */}
      {(stats?.safety_flagged_count > 0 || stats?.critical_count > 0) && (
        <div className="safety-alert" style={{ marginBottom: 20 }}>
          <ShieldAlert size={20} />
          <span>
            <strong>{stats.safety_flagged_count} safety-flagged</strong> and{' '}
            <strong>{stats.critical_count} critical</strong> complaint(s) require immediate human review.
            These are flagged by the deterministic safety signal detector — do not dismiss without assessment.
          </span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard
          label="Total Complaints"
          value={stats?.total_complaints ?? '—'}
          variant="primary"
          icon={<ClipboardList size={28} />}
        />
        <StatCard
          label="Pending Review"
          value={stats?.pending_count ?? '—'}
          icon={<Clock size={28} />}
        />
        <StatCard
          label="Critical"
          value={stats?.critical_count ?? '—'}
          variant="critical"
          icon={<AlertTriangle size={28} />}
        />
        <StatCard
          label="High Priority"
          value={stats?.high_count ?? '—'}
          variant="high"
          icon={<TrendingUp size={28} />}
        />
        <StatCard
          label="Medium"
          value={stats?.medium_count ?? '—'}
          variant="medium"
        />
        <StatCard
          label="Low"
          value={stats?.low_count ?? '—'}
          variant="low"
        />
        <StatCard
          label="Safety Flagged"
          value={stats?.safety_flagged_count ?? '—'}
          variant="safety"
          icon={<ShieldAlert size={28} />}
        />
        <StatCard
          label="Pending Sync"
          value={stats?.pending_sync_count ?? '—'}
        />
      </div>

      {/* Charts Row */}
      <div className="two-col" style={{ marginBottom: 24 }}>
        {/* Department Bar Chart */}
        <div className="chart-card">
          <div className="chart-title">Complaints by Department</div>
          {deptData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptData} margin={{ top: 0, right: 8, bottom: 30, left: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  angle={-30}
                  textAnchor="end"
                />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)' }}
                  formatter={(val, _, { payload }) => [val, payload.fullName]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {deptData.map((_, i) => (
                    <Cell key={i} fill={DEPT_CHART_COLORS[i % DEPT_CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: 40 }}>No data yet</div>
          )}
        </div>

        {/* Urgency Pie */}
        <div className="chart-card">
          <div className="chart-title">Urgency Distribution</div>
          {urgencyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={urgencyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {urgencyData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)' }}
                />
                <Legend
                  formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: 40 }}>No data yet</div>
          )}
        </div>
      </div>

      {/* Department table */}
      {stats?.department_counts?.length > 0 && (
        <div className="chart-card">
          <div className="chart-title">Department Queue Summary</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.department_counts.map(d => (
              <div key={d.department} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', background: 'var(--bg-elevated)',
                borderRadius: 8, border: '1px solid var(--border-subtle)',
              }}>
                <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{DEPARTMENT_ICONS[d.department] || '📋'}</span>
                <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500 }}>{d.department}</span>
                <div style={{
                  background: 'var(--bg-card)', borderRadius: 999,
                  padding: '3px 12px', fontSize: '0.8rem', fontWeight: 700,
                  color: 'var(--text-primary)', border: '1px solid var(--border-default)',
                }}>
                  {d.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
