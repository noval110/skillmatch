import CompetitionFields from '../components/CompetitionFields'
import { useSearchParams } from 'react-router-dom'
import { Filter, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import EmptyState from '../components/EmptyState'
import LoadingSpinner from '../components/LoadingSpinner'
import Navbar from '../components/Navbar'
import TeamCard from '../components/TeamCard'
import { searchTeams } from '../services/api'
import { hydrateTeam, loadTeamDetail } from '../utils/teams'
import { matchesTeamQuery } from '../utils/teamSearch'

export default function Teams() {
  const [params, setParams] = useSearchParams()
  const globalQuery = params.get('q') || ''
  const [filters, setFilters] = useState({ name: '', role: '', skill: '', beginner_friendly: false, competition_category: params.get('competition_category') || '', competition_type: params.get('competition_type') || '' })
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const loadTeams = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await searchTeams(filters)
        const rows = Array.isArray(response) ? response : []
        const detailed = await Promise.all(rows.map((team) => loadTeamDetail(team.id, true).catch(() => hydrateTeam(team, true))))
        if (!cancelled) setTeams(detailed)
      } catch (err) { if (!cancelled) setError(err.message) }
      finally { if (!cancelled) setLoading(false) }
    }
    const timer = setTimeout(loadTeams, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [filters])

  const visibleTeams = teams.filter(team => matchesTeamQuery(team, globalQuery))

  const change = (event) => setFilters((value) => ({ ...value, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }))

  return <div className="teams-page"><Navbar title="Find Your Competition Team" subtitle="Find the right teammates for any competition" /><div className="page-body page-teams">{globalQuery && <div className="directory-query"><span>Teams, skills, or competitions matching <strong>{globalQuery}</strong></span><button onClick={() => setParams(current => { const next = new URLSearchParams(current); next.delete('q'); return next })}>Clear search</button></div>}<section className={`teams-toolbar ${filtersOpen ? 'filters-open' : ''}`}><div className="teams-search-row"><label className="search-field"><Search size={17} /><input name="name" value={filters.name} onChange={change} placeholder="Search teams..." /></label><button className={`button button-filter ${filtersOpen ? 'active' : ''}`} type="button" onClick={() => setFiltersOpen((value) => !value)}><Filter size={15} />Filter</button></div><div className="teams-filter-row competition-filter-row"><CompetitionFields team={filters} onChange={setFilters} filter /></div><label className="preference-checkbox beginner-filter"><input type="checkbox" name="beginner_friendly" checked={filters.beginner_friendly} onChange={change} /><span>Beginner Friendly</span></label>{filtersOpen && <div className="teams-filter-row"><label><span>Role</span><input name="role" value={filters.role} onChange={change} placeholder="All roles" /></label><label><span>Skill</span><input name="skill" value={filters.skill} onChange={change} placeholder="All skills" /></label></div>}</section>{error && <div className="error-message">{error}</div>}{loading ? <LoadingSpinner /> : visibleTeams.length ? <div className="team-results">{visibleTeams.map((team) => <TeamCard compact key={team.id} team={team} roles={team.roles} matchScore={team.matchScore} />)}</div> : <EmptyState title="Team tidak ditemukan" description="Coba ubah kata kunci atau filter pencarian." />}</div></div>
}
