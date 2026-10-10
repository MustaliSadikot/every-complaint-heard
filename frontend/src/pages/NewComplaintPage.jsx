import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { complaintsApi } from '../api';
import { useToast } from '../contexts/ToastContext';
import { LANGUAGE_OPTIONS, SOURCE_OPTIONS, STATIONS } from '../utils';
import { Spinner } from '../components/ui';
import { PlusCircle, Zap, AlertTriangle } from 'lucide-react';

export default function NewComplaintPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [form, setForm] = useState({
    text: '',
    language: 'en',
    station: 'Kalupur',
    source_channel: 'Kiosk',
  });
  const [loading, setLoading] = useState(false);
  const [charCount, setCharCount] = useState(0);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.text.trim()) {
      addToast('Complaint text cannot be empty.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await complaintsApi.create(form);
      addToast(`Complaint created · ${res.data.urgency_level} urgency · ${res.data.department}`, 'success', 6000);
      navigate(`/complaints/${res.data.id}`);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to create complaint.';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <h1>New Complaint</h1>
          <div className="page-subtitle">Submit a new passenger complaint for AI triage</div>
        </div>
      </div>

      {/* AI Triage info */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 18px',
        background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.2)',
        borderRadius: 12, marginBottom: 24, fontSize: '0.85rem', color: '#a5b4fc',
      }}>
        <Zap size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>AI-Powered Triage</strong> — Upon submission, the complaint will be automatically
          classified into a department, assigned an urgency score and given a draft reply in the
          passenger's language. Safety keywords always trigger an immediate human review flag.
        </div>
      </div>

      <div style={{ maxWidth: 700 }}>
        <form onSubmit={handleSubmit} id="new-complaint-form">
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="complaint-text">
                Complaint Text <span style={{ color: 'var(--urgency-critical)' }}>*</span>
              </label>
              <textarea
                id="complaint-text"
                className="form-textarea"
                placeholder="Enter the full complaint text here. Supports English, Hindi (Devanagari or transliterated), Gujarati and mixed languages…"
                value={form.text}
                onChange={e => {
                  set('text', e.target.value);
                  setCharCount(e.target.value.length);
                }}
                rows={6}
                maxLength={5000}
                required
                autoFocus
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                {charCount}/5000 characters
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>Metadata</h4>
            <div className="form-row" style={{ marginBottom: 14 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="language-select">Language</label>
                <select
                  id="language-select"
                  className="form-select"
                  value={form.language}
                  onChange={e => set('language', e.target.value)}
                >
                  {LANGUAGE_OPTIONS.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="station-select">Station</label>
                <select
                  id="station-select"
                  className="form-select"
                  value={form.station}
                  onChange={e => set('station', e.target.value)}
                >
                  {STATIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="source-select">Source Channel</label>
              <select
                id="source-select"
                className="form-select"
                value={form.source_channel}
                onChange={e => set('source_channel', e.target.value)}
              >
                {SOURCE_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Safety notice */}
          <div style={{
            display: 'flex', gap: 10, padding: '10px 14px',
            background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 10, marginBottom: 20, fontSize: '0.8rem', color: '#fca5a5',
          }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              If this is an immediate emergency, call emergency services first.
              The triage system flags safety keywords automatically but is not a substitute for emergency response.
            </span>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading || !form.text.trim()}
              id="submit-complaint-btn"
            >
              {loading ? <Spinner /> : <PlusCircle size={18} />}
              {loading ? 'Triaging…' : 'Submit & Triage'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-lg"
              onClick={() => navigate('/complaints')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
