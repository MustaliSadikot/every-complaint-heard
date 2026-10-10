import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { complaintsApi } from '../api';
import {
  UrgencyBadge, StatusBadge, ModeBadge, LangTag, SyncIndicator,
  UrgencyScoreBar, SafetyAlert, Spinner, SectionTitle, ConfirmModal
} from '../components/ui';
import { useToast } from '../contexts/ToastContext';
import {
  DEPARTMENT_ICONS, DEPARTMENT_OPTIONS, STATUS_OPTIONS, formatDate, LANGUAGE_LABELS
} from '../utils';
import {
  ArrowLeft, Edit2, CheckCircle, RefreshCw, Trash2, AlertTriangle, Send, Clock, MapPin
} from 'lucide-react';

export default function ComplaintDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingReply, setEditingReply] = useState(false);
  const [draftReply, setDraftReply] = useState('');
  const [approvedReply, setApprovedReply] = useState('');
  const [savingReply, setSavingReply] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [newDept, setNewDept] = useState('');
  const [reclassifying, setReclassifying] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await complaintsApi.get(id);
      setComplaint(res.data);
      setDraftReply(res.data.draft_reply || '');
      setApprovedReply(res.data.approved_reply || '');
      setNewStatus(res.data.status);
      setNewDept(res.data.department);
    } catch {
      addToast('Complaint not found', 'error');
      navigate('/complaints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const saveReply = async (approve) => {
    setSavingReply(true);
    try {
      const patch = {
        draft_reply: draftReply,
        reply_edited: draftReply !== complaint.draft_reply,
      };
      if (approve) {
        patch.approved_reply = draftReply;
        patch.review_state = 'Approved';
        patch.status = 'Replied';
      }
      await complaintsApi.update(id, patch);
      setEditingReply(false);
      addToast(approve ? 'Reply approved ✓' : 'Draft saved', 'success');
      load();
    } catch (e) {
      addToast('Failed to save reply', 'error');
    } finally {
      setSavingReply(false);
    }
  };

  const updateStatus = async () => {
    try {
      await complaintsApi.update(id, { status: newStatus, department: newDept });
      setEditingStatus(false);
      addToast('Updated successfully', 'success');
      load();
    } catch {
      addToast('Update failed', 'error');
    }
  };

  const reclassify = async () => {
    setReclassifying(true);
    try {
      await complaintsApi.reclassify(id);
      addToast('Reclassified successfully', 'success');
      load();
    } catch {
      addToast('Reclassification failed', 'error');
    } finally {
      setReclassifying(false);
    }
  };

  const handleDelete = async () => {
    try {
      await complaintsApi.delete(id);
      addToast('Complaint deleted', 'info');
      navigate('/complaints');
    } catch {
      addToast('Delete failed', 'error');
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <Spinner size="lg" />
    </div>
  );

  if (!complaint) return null;

  return (
    <div>
      {/* Back nav */}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => navigate(-1)}
        style={{ marginBottom: 20 }}
        id="back-btn"
      >
        <ArrowLeft size={14} /> Back
      </button>

      {/* Safety Alert */}
      {complaint.safety_flag && (
        <div style={{ marginBottom: 20 }}>
          <SafetyAlert />
        </div>
      )}

      <div className="detail-panel">
        {/* Header */}
        <div className="detail-header">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={{ fontSize: '1.5rem' }}>{DEPARTMENT_ICONS[complaint.department] || '📋'}</span>
                <UrgencyBadge level={complaint.urgency_level} />
                <StatusBadge status={complaint.status} />
                <ModeBadge mode={complaint.classification_mode} />
                <LangTag lang={complaint.language} />
                <SyncIndicator state={complaint.sync_state} />
              </div>
              <p style={{
                fontSize: '1.05rem', color: 'var(--text-primary)',
                lineHeight: 1.7, fontWeight: 400,
              }}>
                {complaint.text}
              </p>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={reclassify}
                disabled={reclassifying}
                id="reclassify-btn"
              >
                {reclassifying ? <Spinner /> : <RefreshCw size={14} />}
                Reclassify
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setEditingStatus(!editingStatus)}
                id="edit-status-btn"
              >
                <Edit2 size={14} /> Edit
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setShowDeleteModal(true)}
                id="delete-complaint-btn"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <MapPin size={12} /> {complaint.station}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <Clock size={12} /> Created: {formatDate(complaint.created_at)}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Channel: {complaint.source_channel}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              ID: <code className="mono" style={{ fontSize: '0.72rem' }}>{complaint.id}</code>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="detail-body">
          {/* Edit status panel */}
          {editingStatus && (
            <div style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border-brand)',
              borderRadius: 12, padding: 16, marginBottom: 20,
            }}>
              <div className="detail-section-title">Edit Classification & Status</div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={newStatus} onChange={e => setNewStatus(e.target.value)} id="status-select">
                    {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className="form-select" value={newDept} onChange={e => setNewDept(e.target.value)} id="dept-select">
                    {DEPARTMENT_OPTIONS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={updateStatus} id="save-status-btn">
                  <CheckCircle size={14} /> Save
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingStatus(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Classification details */}
          <div className="detail-section">
            <div className="detail-section-title">Classification & Urgency</div>
            <div className="detail-kv-grid">
              <div className="detail-kv">
                <div className="detail-kv-key">Department</div>
                <div className="detail-kv-value">
                  {DEPARTMENT_ICONS[complaint.department]} {complaint.department}
                </div>
              </div>
              <div className="detail-kv">
                <div className="detail-kv-key">Urgency Level</div>
                <div className="detail-kv-value">
                  <UrgencyBadge level={complaint.urgency_level} />
                </div>
              </div>
              <div className="detail-kv">
                <div className="detail-kv-key">Urgency Score</div>
                <div className="detail-kv-value">
                  <UrgencyScoreBar score={complaint.urgency_score} level={complaint.urgency_level} />
                </div>
              </div>
              <div className="detail-kv">
                <div className="detail-kv-key">AI Confidence</div>
                <div className="detail-kv-value">
                  {(complaint.classification_confidence * 100).toFixed(0)}%
                </div>
              </div>
              <div className="detail-kv">
                <div className="detail-kv-key">Classification Mode</div>
                <div className="detail-kv-value"><ModeBadge mode={complaint.classification_mode} /></div>
              </div>
              <div className="detail-kv">
                <div className="detail-kv-key">Safety Flag</div>
                <div className="detail-kv-value">
                  {complaint.safety_flag
                    ? <span style={{ color: 'var(--urgency-critical)', fontWeight: 700 }}>⚠️ FLAGGED</span>
                    : <span style={{ color: 'var(--urgency-low)' }}>✓ Clear</span>}
                </div>
              </div>
              <div className="detail-kv">
                <div className="detail-kv-key">Review State</div>
                <div className="detail-kv-value">{complaint.review_state}</div>
              </div>
              <div className="detail-kv">
                <div className="detail-kv-key">Sync State</div>
                <div className="detail-kv-value"><SyncIndicator state={complaint.sync_state} /></div>
              </div>
            </div>
          </div>

          {/* Approved Reply (read-only if set) */}
          {complaint.approved_reply && (
            <div className="detail-section">
              <div className="detail-section-title" style={{ color: '#22c55e' }}>
                <CheckCircle size={12} /> Approved Reply (Sent to Passenger)
              </div>
              <div style={{
                background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: 10, padding: '14px 16px', fontSize: '0.9rem',
                color: 'var(--text-primary)', lineHeight: 1.7,
              }}>
                {complaint.approved_reply}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>
                ⚠️ This prototype does not transmit replies automatically. Controller must copy and send manually.
              </div>
            </div>
          )}

          {/* Draft Reply Editor */}
          <div className="detail-section">
            <div className="detail-section-title">
              AI Draft Reply
              <span style={{ marginLeft: 8 }}>
                <LangTag lang={complaint.reply_language} />
              </span>
              {complaint.reply_edited && (
                <span style={{ fontSize: '0.68rem', color: 'var(--brand-accent)', marginLeft: 4 }}>
                  (edited)
                </span>
              )}
            </div>

            <div className="reply-box">
              <div className="reply-box-header">
                <span className="reply-box-label">
                  {editingReply ? '✏️ Editing' : '🤖 AI Draft'} · {LANGUAGE_LABELS[complaint.reply_language] || complaint.reply_language}
                </span>
                <ModeBadge mode={complaint.classification_mode} />
              </div>

              <textarea
                className="form-textarea reply-textarea"
                value={draftReply}
                onChange={e => { setDraftReply(e.target.value); setEditingReply(true); }}
                rows={5}
                placeholder="AI draft reply will appear here…"
                id="draft-reply-textarea"
              />

              <div className="reply-actions">
                <div style={{ flex: 1, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {complaint.classification_mode === 'AI' ? '🤖 Generated by llama3.1' : '📋 Deterministic template'}
                  {' · '}Review before sending · Do not invent commitments or timelines
                </div>
                {editingReply && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setDraftReply(complaint.draft_reply || ''); setEditingReply(false); }}
                  >
                    Reset
                  </button>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => saveReply(false)}
                  disabled={savingReply}
                  id="save-draft-btn"
                >
                  Save Draft
                </button>
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => saveReply(true)}
                  disabled={savingReply || !draftReply.trim()}
                  id="approve-reply-btn"
                >
                  {savingReply ? <Spinner /> : <CheckCircle size={14} />}
                  Approve Reply
                </button>
              </div>
            </div>

            <div style={{
              marginTop: 10, padding: '8px 12px',
              background: 'rgba(79,70,229,0.06)', borderRadius: 8,
              border: '1px solid rgba(79,70,229,0.15)', fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}>
              ℹ️ Approving a reply marks this complaint as "Replied" and stores the approved text locally.
              This prototype does not send replies automatically — please copy and deliver via the appropriate channel.
            </div>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <ConfirmModal
          title="Delete Complaint"
          message={`Are you sure you want to permanently delete complaint "${complaint.id}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          confirmLabel="Delete"
          danger
        />
      )}
    </div>
  );
}
