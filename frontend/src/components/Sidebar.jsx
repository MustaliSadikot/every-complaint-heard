import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Plus, Upload,
  Settings, RefreshCw, Zap, AlertTriangle, ShieldAlert
} from 'lucide-react';

export default function Sidebar({ aiStatus, criticalCount, highCount, pendingSync }) {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(79,70,229,0.35)',
            flexShrink: 0,
          }}>
            <ShieldAlert size={18} color="#fff" />
          </div>
          <div>
            <div className="sidebar-logo-title">Every Complaint<br />Heard</div>
          </div>
        </div>
        <div className="sidebar-logo-sub" style={{ marginTop: 8 }}>Gujarat Metro · PS-07</div>
        <div className="sidebar-logo-badge">
          <Zap size={9} />
          Hackathon Build
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Overview</div>

        <NavItem to="/" icon={<LayoutDashboard size={18} />} label="Dashboard" end />
        <NavItem
          to="/complaints"
          icon={<ClipboardList size={18} />}
          label="All Complaints"
          badge={criticalCount > 0 ? `${criticalCount} crit` : null}
          badgeClass=""
        />
        <NavItem
          to="/complaints?urgency_level=Critical"
          icon={<AlertTriangle size={18} />}
          label="Critical Queue"
          badge={criticalCount > 0 ? criticalCount : null}
          badgeClass=""
        />

        <div className="nav-section-label" style={{ marginTop: 4 }}>Actions</div>
        <NavItem to="/new" icon={<Plus size={18} />} label="New Complaint" />
        <NavItem to="/import" icon={<Upload size={18} />} label="Batch Import" />

        <div className="nav-section-label" style={{ marginTop: 4 }}>System</div>
        <NavItem
          to="/settings"
          icon={<Settings size={18} />}
          label="Settings & Sync"
          badge={pendingSync > 0 ? `${pendingSync} sync` : null}
          badgeClass="high"
        />
      </nav>

      {/* AI Status */}
      <div className="sidebar-footer">
        <div className="ai-status-pill">
          <div className={`ai-status-dot ${aiStatus ? 'online' : 'offline'}`} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {aiStatus ? 'Ollama Online' : 'Fallback Mode'}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {aiStatus ? 'llama3.1 active' : 'Deterministic AI'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ to, icon, label, badge, badgeClass = '', end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
    >
      <span className="nav-icon">{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && <span className={`nav-badge ${badgeClass}`}>{badge}</span>}
    </NavLink>
  );
}
