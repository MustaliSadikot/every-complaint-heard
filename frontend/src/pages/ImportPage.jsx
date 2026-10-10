import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { complaintsApi } from '../api';
import { useToast } from '../contexts/ToastContext';
import { Spinner } from '../components/ui';
import { Upload, FileJson, FileText, CheckCircle, XCircle, Info, Download } from 'lucide-react';

export default function ImportPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const fileRef = useRef(null);

  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState('json');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFile = (f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['json', 'csv'].includes(ext)) {
      addToast('Only .json and .csv files are supported.', 'error');
      return;
    }
    setFileType(ext);
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const res = fileType === 'json'
        ? await complaintsApi.importJson(file)
        : await complaintsApi.importCsv(file);
      setResult(res.data);
      if (res.data.imported > 0) {
        addToast(`Imported ${res.data.imported} complaint(s)`, 'success');
      }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Import failed';
      addToast(msg, 'error');
      setResult({ imported: 0, skipped: 0, errors: [msg], complaint_ids: [] });
    } finally {
      setLoading(false);
    }
  };

  const downloadSample = () => {
    const sample = [
      { text: "The lift at Kalupur station is broken.", language: "en", station: "Kalupur", source_channel: "Kiosk" },
      { text: "Platform bahut ganda chhe.", language: "gu", station: "GEC", source_channel: "Mobile App" },
      { text: "Staff ne mujhse rude tarike se baat ki.", language: "hi", station: "Maninagar", source_channel: "Phone" },
    ];
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sample_complaints.json'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <h1>Batch Import</h1>
          <div className="page-subtitle">Import multiple complaints from a JSON or CSV file</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={downloadSample} id="download-sample-btn">
          <Download size={14} /> Sample JSON
        </button>
      </div>

      {/* Info */}
      <div style={{
        display: 'flex', gap: 10, padding: '14px 18px',
        background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.2)',
        borderRadius: 12, marginBottom: 24, fontSize: '0.84rem', color: '#a5b4fc',
      }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Import details:</strong> Duplicate IDs are automatically skipped (idempotent).
          Batch imports use the deterministic fallback classifier for speed.
          JSON: array of objects with <code>text</code>, <code>language</code>, <code>station</code> fields.
          CSV: columns <code>text</code>, <code>language</code>, <code>station</code>, <code>source_channel</code>.
        </div>
      </div>

      <div style={{ maxWidth: 640 }}>
        {/* Drop Zone */}
        <div
          className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          id="upload-zone"
          style={{ cursor: 'pointer' }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".json,.csv"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
            id="file-input"
          />

          {file ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              {fileType === 'json'
                ? <FileJson size={40} style={{ color: '#60a5fa' }} />
                : <FileText size={40} style={{ color: '#34d399' }} />}
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                  {file.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {(file.size / 1024).toFixed(1)} KB · {fileType.toUpperCase()}
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={e => { e.stopPropagation(); setFile(null); setResult(null); }}
              >
                Change file
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Upload size={40} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Drop a file here or click to browse
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Supports .json (array) and .csv (with header row)
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Import button */}
        {file && !result && (
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleImport}
              disabled={loading}
              id="import-btn"
            >
              {loading ? <Spinner /> : <Upload size={18} />}
              {loading ? 'Importing…' : `Import ${fileType.toUpperCase()}`}
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => setFile(null)}>Cancel</button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ marginTop: 20 }}>
            <div style={{
              background: 'var(--bg-card)', border: `1px solid ${result.imported > 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              borderRadius: 12, overflow: 'hidden',
            }}>
              <div style={{
                padding: '16px 20px',
                background: result.imported > 0 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                {result.imported > 0
                  ? <CheckCircle size={20} style={{ color: '#22c55e' }} />
                  : <XCircle size={20} style={{ color: 'var(--urgency-critical)' }} />}
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {result.imported > 0 ? 'Import Complete' : 'Import Failed'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {result.imported} imported · {result.skipped} skipped · {result.errors.length} errors
                  </div>
                </div>
              </div>

              <div style={{ padding: '16px 20px' }}>
                {result.errors.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--urgency-critical)', marginBottom: 6 }}>Errors</div>
                    {result.errors.map((e, i) => (
                      <div key={i} style={{
                        fontSize: '0.78rem', color: '#fca5a5',
                        padding: '4px 8px', background: 'rgba(239,68,68,0.08)',
                        borderRadius: 6, marginBottom: 4,
                      }}>{e}</div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  {result.imported > 0 && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate('/complaints')}
                    >
                      View Complaints
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setFile(null); setResult(null); }}
                  >
                    Import Another
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
