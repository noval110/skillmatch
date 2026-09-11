import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ApprovedAsset from '../components/ApprovedAsset'
import { loginUser } from '../services/api'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (event) => {
    event.preventDefault(); setError(''); setLoading(true)
    try {
      const data = await loginUser(email, password)
      localStorage.setItem('token', data.token)
      localStorage.setItem('currentUser', JSON.stringify(data.user))
      navigate('/dashboard')
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return <main className="auth-page"><section className="auth-container"><div className="auth-form-section"><div className="auth-form-wrapper"><div className="form-brand"><ApprovedAsset name="logo" alt="SkillMatch" /></div><h1>Selamat datang kembali!</h1><p className="auth-subtitle">Masuk ke akun SkillMatch untuk melanjutkan.</p>{error && <div className="error-message">{error}</div>}<form onSubmit={handleLogin}><div className="form-group"><label htmlFor="login-email">Email</label><input id="login-email" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></div><div className="form-group"><label htmlFor="login-password">Password</label><input id="login-password" type="password" placeholder="Masukkan password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div><button type="submit" className="primary-button" disabled={loading}>{loading ? 'Memproses...' : 'Masuk'}</button></form><p className="auth-bottom">Belum punya akun? <Link to="/register">Daftar sekarang</Link></p></div></div><div className="auth-visual"><ApprovedAsset name="login" alt="Dua anggota SkillMatch bekerja bersama" /><div className="auth-visual-copy"><h2>Temukan tim yang cocok.</h2><p>Gabung dengan peserta kompetisi lain berdasarkan skill, minat, dan role yang dibutuhkan.</p></div></div></section></main>
}
