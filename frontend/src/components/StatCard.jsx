export default function StatCard({ label, value, icon: Icon, tone = 'red' }) {
  return <article className="stat-card"><div><p>{label}</p><strong>{value}</strong></div><span className={`stat-icon ${tone}`}><Icon size={19} /></span></article>
}
