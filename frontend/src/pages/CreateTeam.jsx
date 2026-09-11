import CompetitionFields from '../components/CompetitionFields'
import TeamPreferenceFields from '../components/TeamPreferenceFields'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ApprovedAsset from '../components/ApprovedAsset'
import Navbar from '../components/Navbar'
import { createTeam } from '../services/api'

export default function CreateTeam() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ competition_category: '', competition_type: '', name: '', description: '', project_idea: '', max_members: 4, beginner_friendly: false, willing_to_mentor: false })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const change = (event) => setForm((value) => ({ ...value, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.name === 'max_members' ? Number(event.target.value) : event.target.value }))
  const submit = async (event) => { event.preventDefault(); setLoading(true); setError(''); try { const data = await createTeam(form); navigate(`/teams/${data.team_id}`) } catch (err) { setError(err.message) } finally { setLoading(false) } }

  return <div className="create-team-page"><Navbar title="Buat Team Baru" subtitle="Buat team dan temukan anggota untuk kompetisi berikutnya." action={false} /><div className="page-body"><Link className="back-link" to="/teams"><ArrowLeft size={15} />Kembali</Link><section className="create-team-shell"><form className="create-team-form" onSubmit={submit}>{error && <div className="error-message">{error}</div>}<label><span>Nama Team</span><input name="name" value={form.name} onChange={change} placeholder="Contoh: ArgueMasters" required /></label><CompetitionFields team={form} onChange={setForm} /><label><span>Tujuan Kompetisi / Ide</span><input name="project_idea" value={form.project_idea} onChange={change} placeholder="Apa yang ingin team kalian capai?" required /></label><label><span>Deskripsi</span><textarea name="description" value={form.description} onChange={change} placeholder="Ceritakan tentang team dan tujuan kalian..." rows="4" /></label><label><span>Maksimal Anggota</span><select name="max_members" value={form.max_members} onChange={change}>{[2,3,4,5,6,7,8,9,10].map((number) => <option key={number} value={number}>{number} anggota</option>)}</select></label><TeamPreferenceFields team={form} onChange={change} /><div className="create-team-actions"><Link className="button button-secondary" to="/teams">Batal</Link><button className="button button-primary" disabled={loading}>{loading ? 'Membuat...' : 'Buat Team'}</button></div></form><div className="create-team-visual"><ApprovedAsset name="createTeam" alt="Membuat team baru" /></div></section></div></div>
}
