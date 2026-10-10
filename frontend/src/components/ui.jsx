import React from 'react';
import { URGENCY_COLORS, DEPARTMENT_ICONS, LANGUAGE_LABELS, formatDateShort, timeAgo } from '../utils';
import { MapPin, Clock, Cpu, ShieldAlert, ChevronRight } from 'lucide-react';

// ─── Urgency Badge ────────────────────────────────────────────────────────────
export function UrgencyBadge({ level }) {
  return <span className={`urgency-badge ${level}`}>{level}</span>;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  return <span className={`status-badge ${status}`}>{status}</span>;
}

// ─── Mode Badge ───────────────────────────────────────────────────────────────
export function ModeBadge({ mode }) {
  return (
    <span className={`mode-badge ${mode}`}>
      <Cpu size={9} />
      {mode}
    </span>
  );
}

// ─── Language Tag ─────────────────────────────────────────────────────────────
export function LangTag({ lang }) {
  return <span className="lang-tag">{LANGUAGE_LABELS[lang] || lang}</span>;
}

// ─── Sync Indicator ───────────────────────────────────────────────────────────
export function SyncIndicator({ state }) {
  const labels = {
    'Local Only': 'local',
    'Pending Sync': 'pending',
    'Synced': 'synced',
    'Sync Failed': 'failed',
  };
  const cls = labels[state] || 'local';
  return <span className={`sync-indicator ${cls}`}>{state}</span>;
}

// ─── Urgency Score Bar ────────────────────────────────────────────────────────
export function UrgencyScoreBar({ score, level }) {
  return (
    <div className="score-bar-wrapper">
      <div className="score-bar-track">
        <div
          className={`score-bar-fill ${level}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`score-label`} style={{ color: URGENCY_COLORS[level] || 'var(--text-muted)' }}>
        {score}
      </span>
    </div>
  );
}

// ─── Safety Alert Banner ──────────────────────────────────────────────────────
export function SafetyAlert({ compact }) {
  if (compact) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: '0.7rem', fontWeight: 700, color: '#fca5a5',
        background: 'rgba(239,68,68,0.12)', padding: '2px 8px',
        borderRadius: '999px', border: '1px solid rgba(239,68,68,0.3)',
      }}>
        <ShieldAlert size={10} /> SAFETY
      </span>
    );
  }
  return (
    <div className="safety-alert">
      <ShieldAlert size={18} />
      <span>⚠️ SAFETY FLAG — This complaint requires immediate human review. Do not dismiss without proper assessment.</span>
    </div>
  );
}

// ─── Complaint Row ────────────────────────────────────────────────────────────
export function ComplaintRow({ complaint, onClick }) {
  return (
    <div
      className={`complaint-row ${complaint.urgency_level}`}
      onClick={() => onClick(complaint.id)}
      id={`complaint-row-${complaint.id}`}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(complaint.id)}
    >
      {/* Department icon */}
      <div style={{ fontSize: '1.3rem', flexShrink: 0 }}>
        {DEPARTMENT_ICONS[complaint.department] || '📋'}
      </div>

      {/* Text + badges */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="complaint-text-preview">{complaint.text}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <LangTag lang={complaint.language} />
          <ModeBadge mode={complaint.classification_mode} />
          {complaint.safety_flag && <SafetyAlert compact />}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <MapPin size={11} /> {complaint.station}
          </span>
        </div>
      </div>

      {/* Urgency + status */}
      <div className="complaint-meta">
        <UrgencyBadge level={complaint.urgency_level} />
        <StatusBadge status={complaint.status} />
        <span className="complaint-time">
          <Clock size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
          {timeAgo(complaint.created_at)}
        </span>
        <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>
    </div>
  );
}

// ─── Loading Spinner ──────────────────────────────────────────────────────────
export function Spinner({ size = '' }) {
  return <div className={`spinner ${size}`} />;
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div>
        <h3 style={{ color: 'var(--text-secondary)' }}>{title}</h3>
        {subtitle && <p style={{ fontSize: '0.85rem', marginTop: 4 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({ label, value, variant = '', icon }) {
  return (
    <div className={`stat-card ${variant}`}>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${variant}`}>{value}</div>
      {icon && <div className="stat-icon">{icon}</div>}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
export function SectionTitle({ children }) {
  return <div className="detail-section-title">{children}</div>;
}

// ─── Confirmation Modal ───────────────────────────────────────────────────────
export function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = 'Confirm', danger }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3>{title}</h3>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
