import { Bell, ChevronRight, LockKeyhole, Palette, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../components/Modal'
import Navbar from '../components/Navbar'

const STORAGE_KEY = 'skillmatchPreferences'
const defaults = { emailNotifications: true, pushNotifications: true, profileDiscoverable: true, reducedMotion: false, compactMode: false }

const readPreferences = () => {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } }
  catch { return defaults }
}

export default function Settings() {
  const navigate = useNavigate()
  const [activePanel, setActivePanel] = useState(null)
  const [preferences, setPreferences] = useState(readPreferences)
  const updatePreference = (key) => setPreferences((current) => ({ ...current, [key]: !current[key] }))

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    document.body.classList.toggle('reduce-motion', preferences.reducedMotion)
    document.body.classList.toggle('compact-ui', preferences.compactMode)
  }, [preferences])

  const settings = [
    { id: 'account', icon: UserRound, title: 'Account', description: 'Kelola nama, bio, pengalaman, dan skill.', action: () => navigate('/profile') },
    { id: 'notifications', icon: Bell, title: 'Notifikasi', description: 'Atur preferensi notifikasi email dan push.', action: () => setActivePanel('notifications') },
    { id: 'privacy', icon: LockKeyhole, title: 'Privasi & Keamanan', description: 'Kelola privasi data dan keamanan akun.', action: () => setActivePanel('privacy') },
    { id: 'appearance', icon: Palette, title: 'Tampilan', description: 'Atur gerakan dan kepadatan tampilan aplikasi.', action: () => setActivePanel('appearance') },
  ]

  return <div className="settings-page"><Navbar title="Pengaturan" subtitle="Kelola preferensi akun dan aplikasi kamu." action={false} /><div className="page-body"><div className="settings-list">{settings.map(({ id, icon: Icon, title, description, action }) => <button className="settings-card" type="button" key={id} onClick={action}><span className="settings-icon"><Icon size={18} /></span><span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={17} /></button>)}</div><p className="settings-note">Preferensi notifikasi, privasi, dan tampilan disimpan di perangkat ini.</p></div><Modal open={activePanel === 'notifications'} title="Pengaturan Notifikasi" onClose={() => setActivePanel(null)}><div className="settings-options"><SettingToggle label="Notifikasi email" description="Terima informasi aktivitas melalui email." checked={preferences.emailNotifications} onChange={() => updatePreference('emailNotifications')} /><SettingToggle label="Notifikasi aplikasi" description="Tampilkan pemberitahuan aktivitas di aplikasi." checked={preferences.pushNotifications} onChange={() => updatePreference('pushNotifications')} /></div></Modal><Modal open={activePanel === 'privacy'} title="Privasi & Keamanan" onClose={() => setActivePanel(null)}><div className="settings-options"><SettingToggle label="Profil dapat ditemukan" description="Izinkan anggota lain menemukan profil kamu." checked={preferences.profileDiscoverable} onChange={() => updatePreference('profileDiscoverable')} /><p className="settings-local-note">Pengaturan ini hanya tersimpan pada perangkat ini dan belum dikirim ke server.</p></div></Modal><Modal open={activePanel === 'appearance'} title="Pengaturan Tampilan" onClose={() => setActivePanel(null)}><div className="settings-options"><SettingToggle label="Kurangi animasi" description="Nonaktifkan sebagian besar transisi dan animasi." checked={preferences.reducedMotion} onChange={() => updatePreference('reducedMotion')} /><SettingToggle label="Mode compact" description="Kurangi jarak vertikal pada kartu dan konten." checked={preferences.compactMode} onChange={() => updatePreference('compactMode')} /></div></Modal></div>
}

function SettingToggle({ label, description, checked, onChange }) {
  return <label className="setting-toggle"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={onChange} /><i aria-hidden="true" /></label>
}
