// Global search augments the existing API filters using the already hydrated rows.
export function matchesTeamQuery(team, query) {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return true
  const fields = [team.name, team.competition_type, team.competition_category,
    ...(team.roles || []).flatMap(role => [role.role_name, ...(role.skills || []).map(skill => skill.skill_name)])]
  return fields.some(value => typeof value === 'string' && value.toLocaleLowerCase().includes(needle))
}
