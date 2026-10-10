import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { complaintsApi } from '../api';
import { ComplaintRow, Spinner, EmptyState } from '../components/ui';
import { DEPARTMENT_OPTIONS, STATUS_OPTIONS } from '../utils';
import { Search, Filter, SlidersHorizontal, ClipboardList, RefreshCw, X } from 'lucide-react';

const URGENCY_OPTIONS = ['Critical', 'High', 'Medium', 'Low'];
const PAGE_SIZE = 15;

export default function ComplaintsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [data, setData] = useState({ items: [], total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [urgencyFilter, setUrgencyFilter] = useState(searchParams.get('urgency_level') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [deptFilter, setDeptFilter] = useState(searchParams.get('department') || '');
  const [safetyOnly, setSafetyOnly] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = {
        page: p,
        page_size: PAGE_SIZE,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      if (search) params.search = search;
      if (urgencyFilter) params.urgency_level = urgencyFilter;
      if (statusFilter) params.status = statusFilter;
      if (deptFilter) params.department = deptFilter;
      if (safetyOnly) params.safety_flag = true;

      const res = await complaintsApi.list(params);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load complaints', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, urgencyFilter, statusFilter, deptFilter, safetyOnly, sortBy, sortOrder]);

  useEffect(() => { load(page); }, [page]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
    load(1);
  }, [urgencyFilter, statusFilter, deptFilter, safetyOnly, sortBy, sortOrder]);

  const handleSearch = (e) => {
    if (e.key === 'Enter') { setPage(1); load(1); }
  };

  const clearFilters = () => {
    setSearch(''); setUrgencyFilter(''); setStatusFilter('');
    setDeptFilter(''); setSafetyOnly(false);
  };

  const hasFilters = search || urgencyFilter || statusFilter || deptFilter || safetyOnly;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <h1>All Complaints</h1>
          <div className="page-subtitle">
            {data.total} complaint{data.total !== 1 ? 's' : ''} · Page {page} of {data.total_pages}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => load(page)} id="complaints-refresh-btn">
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/new')} id="new-complaint-btn">
            + New Complaint
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-wrapper" style={{ flex: 2, minWidth: 220 }}>
          <Search className="search-icon" size={16} />
          <input
            className="form-input search-input"
            placeholder="Search complaints, stations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleSearch}
            id="complaint-search-input"
          />
        </div>

        <select
          className="form-select"
          style={{ width: 140 }}
          value={urgencyFilter}
          onChange={e => setUrgencyFilter(e.target.value)}
          id="urgency-filter"
        >
          <option value="">All Urgencies</option>
          {URGENCY_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        <select
          className="form-select"
          style={{ width: 140 }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          id="status-filter"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          className="form-select"
          style={{ width: 180 }}
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          id="department-filter"
        >
          <option value="">All Departments</option>
          {DEPARTMENT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <button
          className={`btn btn-sm ${safetyOnly ? 'btn-danger' : 'btn-ghost'}`}
          onClick={() => setSafetyOnly(v => !v)}
          id="safety-filter-btn"
          style={{ flexShrink: 0 }}
        >
          🚨 Safety Only
        </button>

        <select
          className="form-select"
          style={{ width: 150 }}
          value={`${sortBy}_${sortOrder}`}
          onChange={e => {
            const [sb, so] = e.target.value.split('_');
            setSortBy(sb); setSortOrder(so);
          }}
          id="sort-select"
        >
          <option value="created_at_desc">Newest First</option>
          <option value="created_at_asc">Oldest First</option>
          <option value="urgency_score_desc">Highest Urgency</option>
          <option value="urgency_score_asc">Lowest Urgency</option>
        </select>

        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={clearFilters} id="clear-filters-btn">
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Spinner size="lg" />
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={48} />}
          title="No complaints found"
          subtitle={hasFilters ? "Try adjusting your filters." : "No complaints in the system yet."}
          action={
            <button className="btn btn-primary" onClick={() => navigate('/new')}>
              Create First Complaint
            </button>
          }
        />
      ) : (
        <>
          <div className="complaint-list">
            {data.items.map(c => (
              <ComplaintRow
                key={c.id}
                complaint={c}
                onClick={(id) => navigate(`/complaints/${id}`)}
              />
            ))}
          </div>

          {/* Pagination */}
          {data.total_pages > 1 && (
            <div className="pagination">
              <button
                className="page-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ‹
              </button>
              {Array.from({ length: Math.min(7, data.total_pages) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    className={`page-btn ${p === page ? 'active' : ''}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                );
              })}
              {data.total_pages > 7 && <span style={{ color: 'var(--text-muted)' }}>…</span>}
              <button
                className="page-btn"
                onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                disabled={page === data.total_pages}
              >
                ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
