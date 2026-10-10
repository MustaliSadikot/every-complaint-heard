import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 35000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Complaints ──────────────────────────────────────────────────────────────
export const complaintsApi = {
  list: (params) => api.get('/complaints/', { params }),
  get: (id) => api.get(`/complaints/${id}`),
  create: (data) => api.post('/complaints/', data),
  update: (id, data) => api.patch(`/complaints/${id}`, data),
  delete: (id) => api.delete(`/complaints/${id}`),
  reclassify: (id) => api.post(`/complaints/${id}/reclassify`),
  importJson: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/complaints/import/json', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importCsv: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/complaints/import/csv', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
};

// ─── System ──────────────────────────────────────────────────────────────────
export const systemApi = {
  aiStatus: () => api.get('/ai/status'),
  syncStatus: () => api.get('/sync/status'),
  triggerSync: () => api.post('/sync/trigger'),
  getThresholds: () => api.get('/config/thresholds'),
  updateThresholds: (data) => api.put('/config/thresholds', data),
};

export default api;
