import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ApprovedAsset from '../components/ApprovedAsset'
import { registerUser } from '../services/api'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', experienceLevel: 'beginner' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const handleChange = (event) => setForm({ ...form, [event.target.name]: event.target.value })
  const handleRegister = async (event) => {
    event.preventDefault(); setError(''); setLoading(true)
    try { await registerUser(form.name, form.email, form.password, form.experienceLevel); navigate('/login') }
    catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return <main className="auth-page"><section className="auth-container"><div className="auth-form-section"><div className="auth-form-wrapper"><div className="form-brand"><ApprovedAsset name="logo" alt="SkillMatch" /></div><h1>Buat akun baru</h1><p className="auth-subtitle">Bergabunglah dengan SkillMatch dan temukan team impianmu.</p>{error && <div className="error-message">{error}</div>}<form onSubmit={handleRegister}><div className="form-group"><label htmlFor="register-name">Nama Lengkap</label><input id="register-name" name="name" type="text" placeholder="Nama lengkap" value={form.name} onChange={handleChange} required /></div><div className="form-group"><label htmlFor="register-email">Email</label><input id="register-email" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required /></div><div className="form-group"><label htmlFor="register-password">Password</label><input id="register-password" name="password" type="password" placeholder="Minimal 6 karakter" value={form.password} onChange={handleChange} minLength={6} required /></div><div className="form-group"><label htmlFor="experience-level">Experience Level</label><select id="experience-level" name="experienceLevel" value={form.experienceLevel} onChange={handleChange}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div><button type="submit" className="primary-button" disabled={loading}>{loading ? 'Memproses...' : 'Daftar'}</button></form><p className="auth-bottom">Sudah punya akun? <Link to="/login">Masuk</Link></p></div></div><div className="auth-visual"><ApprovedAsset name="register" alt="Dua anggota SkillMatch melakukan high five" /><div className="auth-visual-copy"><h2>Bangun tim impianmu.</h2><p>Temukan orang dengan kemampuan yang tepat untuk kompetisi berikutnya.</p></div></div></section></main>
}
