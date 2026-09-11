export default function LoadingSpinner({ label = 'Memuat data...' }) {
  return <div className="loading-state" aria-live="polite" aria-label={label}><div className="skeleton-card"><span className="skeleton-avatar" /><span className="skeleton-lines"><i /><i /><i /></span></div><div className="skeleton-card"><span className="skeleton-avatar" /><span className="skeleton-lines"><i /><i /><i /></span></div><span className="sr-only">{label}</span></div>
}
