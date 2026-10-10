import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import ComplaintsPage from './pages/ComplaintsPage';
import ComplaintDetailPage from './pages/ComplaintDetailPage';
import NewComplaintPage from './pages/NewComplaintPage';
import ImportPage from './pages/ImportPage';
import SettingsPage from './pages/SettingsPage';
import { dashboardApi, systemApi } from './api';

export default function App() {
  const [aiStatus, setAiStatus] = useState(false);
  const [criticalCount, setCriticalCount] = useState(0);
  const [highCount, setHighCount] = useState(0);
  const [pendingSync, setPendingSync] = useState(0);

  const loadGlobalStatus = async () => {
    try {
      const [statsRes, aiRes] = await Promise.allSettled([
        dashboardApi.stats(),
        systemApi.aiStatus(),
      ]);
      if (statsRes.status === 'fulfilled') {
        const d = statsRes.value.data;
        setCriticalCount(d.critical_count || 0);
        setHighCount(d.high_count || 0);
        setPendingSync(d.pending_sync_count || 0);
      }
      if (aiRes.status === 'fulfilled') {
        setAiStatus(aiRes.value.data.available || false);
      }
    } catch {}
  };

  useEffect(() => {
    loadGlobalStatus();
    const t = setInterval(loadGlobalStatus, 45000);
    return () => clearInterval(t);
  }, []);

  return (
    <BrowserRouter>
      <ToastProvider>
        <div className="app-shell">
          <Sidebar
            aiStatus={aiStatus}
            criticalCount={criticalCount}
            highCount={highCount}
            pendingSync={pendingSync}
          />
          <main className="main-content">
            <div className="page-content">
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/complaints" element={<ComplaintsPage />} />
                <Route path="/complaints/:id" element={<ComplaintDetailPage />} />
                <Route path="/new" element={<NewComplaintPage />} />
                <Route path="/import" element={<ImportPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </main>
        </div>
      </ToastProvider>
    </BrowserRouter>
  );
}
