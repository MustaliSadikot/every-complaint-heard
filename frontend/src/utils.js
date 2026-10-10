// Shared utility functions for the frontend

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export const URGENCY_COLORS = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
};

export const DEPARTMENT_ICONS = {
  'Safety': '🚨',
  'Cleanliness': '🧹',
  'Fare and Ticketing': '🎫',
  'Lifts and Escalators': '🛗',
  'Staff Behaviour': '👤',
  'Other/General': '📋',
};

export const LANGUAGE_LABELS = {
  en: 'English',
  hi: 'Hindi',
  gu: 'Gujarati',
  mixed_gu_en: 'Gu+En',
  mixed_hi_en: 'Hi+En',
};

export const STATUS_OPTIONS = [
  'Pending', 'In Review', 'Replied', 'Resolved', 'Escalated'
];

export const DEPARTMENT_OPTIONS = [
  'Safety', 'Cleanliness', 'Fare and Ticketing',
  'Lifts and Escalators', 'Staff Behaviour', 'Other/General',
];

export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'mixed_gu_en', label: 'Gujarati + English' },
  { value: 'mixed_hi_en', label: 'Hindi + English' },
];

export const SOURCE_OPTIONS = [
  'Kiosk', 'Mobile App', 'Email', 'Phone', 'In Person', 'Import Batch', 'Other'
];

export const STATIONS = [
  'Kalupur', 'Vastral Metro', 'Apparel Park', 'Maninagar',
  'GEC', 'Sector 28', 'Riverfront', 'Thaltej', 'Shreyas',
  'Sector 3', 'Motera', 'Ranip', 'Other',
];
