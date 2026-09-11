import { Inbox } from 'lucide-react'

export default function EmptyState({ title = 'Belum ada data', description = 'Data akan tampil di sini saat tersedia.' }) {
  return <div className="empty-state"><Inbox size={28} /><h3>{title}</h3><p>{description}</p></div>
}
