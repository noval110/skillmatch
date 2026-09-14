import { ArrowRight, Check, CircleAlert, RefreshCw, Target, UsersRound } from 'lucide-react'
import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import useAsync from '../../hooks/useAsync'
import { getTeamReadiness } from '../../services/api'
import '../../styles/readiness.css'

const componentLabels = [['team_composition', 'Team Composition'], ['role_coverage', 'Role Coverage'], ['skill_coverage', 'Required Skills'], ['profile_readiness', 'Profile Readiness']]
const statusLabels = { covered: 'Covered', partial: 'Needs improvement', missing: 'Missing', setup_required: 'Setup required', unknown: 'Verify level' }
const levelLabel = value => value ? value.charAt(0).toUpperCase() + value.slice(1) : 'None'
function CoverageStatus({ status, role = false }) {
  const label = role && status === 'partial' ? 'Partially covered' : role && status === 'missing' ? 'Open / missing' : statusLabels[status] || 'Verify status'
  return <span className={`readiness-status status-${status}`}>{status === 'covered' ? <Check size={13} /> : <CircleAlert size={13} />}{label}</span>
}

export default function TeamReadinessPanel({ team, owner, onManage }) {
  const loader = useCallback(() => getTeamReadiness(team.id), [team.id])
  const { data, loading, error, reload } = useAsync(loader)
  if (loading) return <section className="team-readiness" aria-busy="true"><div className="readiness-loading" role="status"><Target size={24} /><span>Analyzing team roles, skills, and profiles...</span></div></section>
  if (error || !data) return <section className="team-readiness readiness-load-error" role="alert"><CircleAlert size={24} /><h2>Readiness couldn't be loaded.</h2><p>{error || 'Please try again.'}</p><button className="button button-secondary" onClick={reload}><RefreshCw size={15} />Retry</button></section>
  const available = data.status === 'ready' && data.readiness_score != null
  const summary = data.summary
  const incompleteProfileCopy = summary.incomplete_profiles === 1 ? '1 member has an incomplete profile' : `${summary.incomplete_profiles} members have incomplete profiles`
  const priority = data.priority_gaps?.[0]
  const discoveryQuery = priority && priority.type !== 'profile' ? `?q=${encodeURIComponent(priority.name)}` : ''
  return <section className="team-readiness" aria-label="Team readiness analysis">
    <header className="readiness-page-heading"><div><span className="readiness-eyebrow">TEAM READINESS · V1</span><h2>Know your strengths.<br />Build what comes next.</h2></div><button className="button button-secondary" onClick={reload}><RefreshCw size={15} />Refresh analysis</button></header>
    <div className={`readiness-summary-panel ${available ? '' : 'setup-incomplete'}`}>
      <div className="readiness-score-display">{available ? <><strong>{data.readiness_score}<span>%</span></strong><span>Team readiness</span></> : <Target size={38} />}</div>
      <div><h3>{available ? 'A clearer picture of your team.' : 'Readiness setup incomplete'}</h3><p>{data.message}</p>{available ? <div className="readiness-strengths"><span>Key strengths</span>{data.strengths.length ? data.strengths.map(name => <span key={name}>{name}</span>) : <span>Build coverage in your required skills.</span>}</div> : <button className="button button-primary" onClick={onManage}>{owner ? 'Set Up Team Roles' : 'View Team Roles'}<ArrowRight size={15} /></button>}</div>
    </div>
    <div className="readiness-component-grid">{componentLabels.map(([key, label]) => <article className="readiness-component" key={key}><div><h3>{label}</h3><span>{data.weights[key]}% weight</span></div><strong>{data.components[key] == null ? '—' : `${data.components[key]}%`}</strong>{data.components[key] != null ? <progress aria-label={label} max="100" value={data.components[key]} /> : <p>Complete setup to measure</p>}<p>{key === 'team_composition' ? `${summary.member_count} / ${summary.capacity} member capacity` : key === 'role_coverage' ? `${summary.covered_roles} / ${summary.role_count} roles covered` : key === 'skill_coverage' ? `${summary.covered_skills} covered · ${summary.partial_skills} partial · ${summary.missing_skills} missing` : incompleteProfileCopy}</p></article>)}</div>
    <div className="readiness-content-grid"><div>
      <section className="readiness-section"><header><div><h3>Skill Coverage</h3><p>Each unique skill uses the highest level required across your roles.</p></div><span>{data.skills.length} required</span></header>
        {data.skills.length ? <div className="readiness-skill-list">{data.skills.map(skill => <article className="readiness-skill" key={skill.skill_id}><div className="readiness-row-title"><h4>{skill.name}</h4><CoverageStatus status={skill.status} /></div><div className="readiness-levels"><span>Required: <strong>{levelLabel(skill.required_level)}</strong></span><span>Team: <strong>{levelLabel(skill.highest_team_level)}</strong></span></div><details><summary>{skill.members.length ? `${skill.members.length} team ${skill.members.length === 1 ? 'member has' : 'members have'} this skill` : 'No team member has this skill'}</summary>{skill.members.length > 0 && <ul>{skill.members.map(member => <li key={member.id}><Link to={`/users/${member.id}`}>{member.name}</Link><span>{levelLabel(member.level)}{member.meets_requirement ? ' · Meets requirement' : ' · Needs development'}</span></li>)}</ul>}</details></article>)}</div> : <p className="readiness-empty-note">Add required skills to your team roles to see coverage and learning opportunities.</p>}
      </section>
      <section className="readiness-section"><header><div><h3>Role Coverage</h3><p>Owner-confirmed status and collective skill requirements, together.</p></div></header>
        {data.roles.length ? data.roles.map(role => <article className="readiness-role" key={role.id}><div className="readiness-row-title"><div><h4>{role.name}</h4><small>Team status: {role.status}</small></div><CoverageStatus status={role.coverage_status} role /></div><div className="readiness-role-skills">{role.required_skills.length ? role.required_skills.map(skill => <span key={skill.skill_id} className={`status-${skill.status}`}>{skill.name} · {levelLabel(skill.required_level)}</span>) : <span>Required skills not configured</span>}</div>{owner && <button className="readiness-text-button" onClick={onManage}>Manage Role <ArrowRight size={13} /></button>}</article>) : <p className="readiness-empty-note">No team roles have been defined yet.</p>}
        <p className="readiness-method-note">Skills can be supported by different members. Skill coverage does not assign a person to a role or measure how much work they can take on.</p>
      </section>
    </div><aside>
      <section className="readiness-action-card"><span className="readiness-eyebrow">PRIORITY ACTION</span><Target size={24} /><h3>{!available ? 'Complete your team setup.' : priority ? priority.name : 'Keep learning together.'}</h3><p>{data.recommended_actions[0] || 'All configured requirements are covered. Review your preparation together before the competition.'}</p>{!available ? <button className="button button-primary" onClick={onManage}>{owner ? 'Set Up Team Roles' : 'View Team Roles'}</button> : priority?.type === 'profile' ? <Link className="button button-primary" to="/profile">Update My Profile</Link> : priority ? <Link className="button button-primary" to={`/teams${discoveryQuery}`}>Find Teammates<ArrowRight size={15} /></Link> : <Link className="button button-secondary" to="/messages">Connect with Your Team</Link>}{available && priority && priority.type !== 'profile' && <small>Explore teams with related roles and skills.</small>}</section>
      {data.recommended_actions.length > 1 && <section className="readiness-section readiness-next-steps"><header><h3>Next steps</h3></header><ol>{data.recommended_actions.slice(1).map((action, index) => <li key={`${index}-${action}`}>{action}</li>)}</ol></section>}
      <section className="readiness-section readiness-profiles"><header><h3><UsersRound size={17} />Profile Readiness</h3></header><p>{summary.incomplete_profiles ? `${incompleteProfileCopy}.` : 'Your members have completed their profile basics.'}</p><p>Better profiles make strengths and learning goals easier to understand.</p>{data.member_profiles.map(member => <div key={member.id}><Link to={`/users/${member.id}`}>{member.name}</Link><span>{member.completed_fields} / {member.total_fields} basics</span></div>)}<Link className="readiness-text-button" to="/profile">Update My Profile<ArrowRight size={13} /></Link></section>
    </aside></div>
    <details className="readiness-formula"><summary>How this score is calculated</summary><p>Readiness = 25% team composition + 30% role coverage + 35% required skill coverage + 10% member profile completeness. Each component is normalized to 100; the final score is rounded once.</p><ul>{data.assumptions.map(note => <li key={note}>{note}</li>)}</ul><p>“Ready” means the analysis can be calculated. It does not certify that the team is ready to win or participate in a competition.</p></details>
  </section>
}
