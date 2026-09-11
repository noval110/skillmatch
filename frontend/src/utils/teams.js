import { getRoleMatch, getRoleSkills, getTeam, getTeamRoles } from '../services/api'

export async function hydrateTeam(team, includeMatches = false) {
  const roles = await getTeamRoles(team.id).catch(() => [])
  const roleRows = Array.isArray(roles) ? roles : []
  const hydratedRoles = await Promise.all(roleRows.map(async (role) => {
    const [skills, match] = await Promise.all([
      getRoleSkills(team.id, role.id).catch(() => []),
      includeMatches && localStorage.getItem('token') ? getRoleMatch(team.id, role.id).catch(() => null) : null,
    ])
    return { ...role, skills, match }
  }))
  const scores = hydratedRoles.map((role) => role.match?.match_score).filter(Number.isFinite)
  return { ...team, roles: hydratedRoles, matchScore: scores.length ? Math.max(...scores) : undefined }
}

export async function loadTeamDetail(teamId, includeMatches = true) {
  const response = await getTeam(teamId)
  const payload = response && typeof response === 'object' ? response : {}
  const team = payload.team || payload
  return { ...(await hydrateTeam(team, includeMatches)), members: Array.isArray(payload.members) ? payload.members : [] }
}
