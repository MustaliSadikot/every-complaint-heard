import React, { useState, useEffect } from 'react';
import { systemApi } from '../api';
import { useToast } from '../contexts/ToastContext';
import { Spinner } from '../components/ui';
import { RefreshCw, Settings, Cpu, Cloud, CloudOff, Sliders, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  const { addToast } = useToast();

  const [aiStatus, setAiStatus] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [thresholds, setThresholds] = useState({ urgency_critical_min: 80, urgency_high_min: 60, urgency_medium_min: 30 });
  const [loadingAI, setLoadingAI] = useState(true);
  const [loadingSync, setLoadingSync] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingThresholds, setSavingThresholds] = useState(false);

  const loadAI = async () => {
    setLoadingAI(true);
    try {
      const res = await systemApi.aiStatus();
      setAiStatus(res.data);
    } catch { setAiStatus(null); }
    setLoadingAI(false);
  };

  const loadSync = async () => {
    setLoadingSync(true);
    try {
      const res = await systemApi.syncStatus();
      setSyncStatus(res.data);
    } catch { setSyncStatus(null); }
    setLoadingSync(false);
  };

  const loadThresholds = async () => {
    try {
      const res = await systemApi.getThresholds();
      setThresholds(res.data);
    } catch {}
  };

  useEffect(() => { loadAI(); loadSync(); loadThresholds(); }, []);

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const res = await systemApi.triggerSync();
      const d = res.data;
      addToast(`${d.message}`, d.succeeded > 0 ? 'success' : 'warning', 6000);
      loadSync();
    } catch (err) {
      addToast('Sync trigger failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const saveThresholds = async () => {
    setSavingThresholds(true);
    try {
      await systemApi.updateThresholds(thresholds);
      addToast('Urgency thresholds updated (runtime only)', 'success');
    } catch {
      addToast('Failed to update thresholds', 'error');
    } finally {
      setSavingThresholds(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <h1>Settings & Sync</h1>
          <div className="page-subtitle">Local AI status, synchronisation and urgency thresholds</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>

        {/* AI Status Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <Cpu size={18} style={{ color: 'var(--text-brand)' }} /> Local AI (Ollama)
            </div>
            <button className="btn btn-ghost btn-sm" onClick={loadAI} id="refresh-ai-btn">
              <RefreshCw size={14} /> Check
            </button>
          </div>

          {loadingAI ? (
            <Spinner />
          ) : aiStatus ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div className={`ai-status-dot ${aiStatus.available ? 'online' : 'offline'}`} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {aiStatus.available ? '✓ Online' : '✗ Unavailable — Fallback Mode Active'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {aiStatus.message}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['Model', aiStatus.model],
                  ['Endpoint', aiStatus.endpoint],
                ].map(([k, v]) => (
                  <div key={k} className="detail-kv">
                    <div className="detail-kv-key">{k}</div>
                    <div className="detail-kv-value" style={{ wordBreak: 'break-all', fontSize: '0.8rem' }}>{v}</div>
                  </div>
                ))}
              </div>
              {!aiStatus.available && (
                <div style={{
                  marginTop: 12, padding: '10px 14px',
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                  borderRadius: 8, fontSize: '0.8rem', color: '#fcd34d',
                }}>
                  ⚡ Deterministic fallback is active — all complaint classification and urgency scoring
                  continues to work without AI. The fallback uses keyword-matching and is always reliable.
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>Could not reach backend.</p>
          )}
        </div>

        {/* Sync Status Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              {syncStatus?.server_configured
                ? <Cloud size={18} style={{ color: '#22c55e' }} />
                : <CloudOff size={18} style={{ color: 'var(--text-muted)' }} />}
              Synchronisation
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={loadSync} id="refresh-sync-btn">
                <RefreshCw size={14} /> Refresh
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={triggerSync}
                disabled={syncing || !syncStatus?.server_configured}
                id="trigger-sync-btn"
              >
                {syncing ? <Spinner /> : <RefreshCw size={14} />}
                Sync Now
              </button>
            </div>
          </div>

          {loadingSync ? <Spinner /> : syncStatus ? (
            <div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                {syncStatus.message}
              </div>
              <div className="detail-kv-grid">
                <div className="detail-kv">
                  <div className="detail-kv-key">Server Configured</div>
                  <div className="detail-kv-value">
                    {syncStatus.server_configured ? '✓ Yes' : '✗ No (local-only mode)'}
                  </div>
                </div>
                <div className="detail-kv">
                  <div className="detail-kv-key">Pending Records</div>
                  <div className="detail-kv-value">{syncStatus.pending_count}</div>
                </div>
              </div>
              {!syncStatus.server_configured && (
                <div style={{
                  marginTop: 12, padding: '10px 14px',
                  background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.15)',
                  borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-muted)',
                }}>
                  Set <code>SYNC_SERVER_URL</code> in the backend <code>.env</code> file to enable remote synchronisation.
                  Records accumulate locally and will sync once a server is configured.
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>Could not reach backend.</p>
          )}
        </div>

        {/* Urgency Thresholds */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 16 }}>
            <Sliders size={18} style={{ color: 'var(--brand-accent)' }} />
            Urgency Thresholds
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>
              (prototype defaults per FR-03 · runtime only)
            </span>
          </div>

          <div className="form-row-3" style={{ marginBottom: 16 }}>
            {[
              { key: 'urgency_critical_min', label: 'Critical Min', color: 'var(--urgency-critical)' },
              { key: 'urgency_high_min', label: 'High Min', color: 'var(--urgency-high)' },
              { key: 'urgency_medium_min', label: 'Medium Min', color: 'var(--urgency-medium)' },
            ].map(({ key, label, color }) => (
              <div className="form-group" key={key}>
                <label className="form-label" style={{ color }}>{label} (0–100)</label>
                <input
                  type="number"
                  className="form-input"
                  min={0}
                  max={100}
                  value={thresholds[key]}
                  onChange={e => setThresholds(t => ({ ...t, [key]: parseInt(e.target.value) || 0 }))}
                  id={`threshold-${key}`}
                />
              </div>
            ))}
          </div>

          <div style={{
            fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 14,
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
          }}>
            <span>🔴 Critical: ≥ {thresholds.urgency_critical_min}</span>
            <span>🟠 High: {thresholds.urgency_high_min}–{thresholds.urgency_critical_min - 1}</span>
            <span>🟡 Medium: {thresholds.urgency_medium_min}–{thresholds.urgency_high_min - 1}</span>
            <span>🟢 Low: 0–{thresholds.urgency_medium_min - 1}</span>
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={saveThresholds}
            disabled={savingThresholds}
            id="save-thresholds-btn"
          >
            {savingThresholds ? <Spinner /> : <CheckCircle size={14} />}
            Apply Thresholds
          </button>
        </div>

        {/* Offline Notice */}
        <div style={{
          padding: '14px 18px',
          background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)',
          borderRadius: 12, fontSize: '0.83rem', color: '#86efac',
        }}>
          🌐 <strong>Offline-First Design:</strong> All complaint intake, classification, urgency scoring
          and draft reply generation work without internet access. The SQLite database persists all data
          across application restarts. Synchronisation to a remote server is optional and safe.
        </div>
      </div>
    </div>
  );
}
