import { getJoinRequests, getProfile, getProfileSkills, getRecommendedTeams, getTeam, getTeams } from './api'
import { getCurrentUserId } from '../utils/auth'

const capture = async (request) => {
  try { return { data: await request() } } catch (error) { return { data: null, error: error.message } }
}
const array = (value) => { if (!Array.isArray(value)) throw new Error('Unexpected response. Please retry.'); return value }

export async function loadDashboard() {
  const [profileResult, skillsResult, teamsResult, recommendationsResult] = await Promise.all([
    capture(getProfile), capture(async () => array(await getProfileSkills())),
    capture(async () => array(await getTeams())), capture(async () => array(await getRecommendedTeams())),
  ])
  const userId = Number(profileResult.data?.id) || getCurrentUserId()
  const errors = {}
  if (profileResult.error) errors.profile = profileResult.error
  if (skillsResult.error) errors.skills = skillsResult.error
  if (recommendationsResult.error) errors.recommendations = recommendationsResult.error
  let myTeams = null
  let pendingRequests = null
  if (teamsResult.data && userId) {
    // No current-user teams endpoint exists. Read memberships with bounded concurrency;
    // unlike the previous loader, do not fetch every team's roles, skills, or matches.
    const details = []
    for (let i = 0; i < teamsResult.data.length; i += 6) {
      details.push(...await Promise.all(teamsResult.data.slice(i, i + 6).map(async team => {
        const result = await capture(() => getTeam(team.id))
        if (!result.data || !Array.isArray(result.data.members)) {
          errors.teams = 'Some team memberships could not be loaded.'
          return Number(team.owner_id) === userId ? { ...team, members: null } : null
        }
        return { ...(result.data.team || team), members: result.data.members }
      })))
    }
    myTeams = details.filter(team => team && (Number(team.owner_id) === userId || team.members?.some(member => Number(member.id) === userId)))
    const ownedTeams = teamsResult.data.filter(team => Number(team.owner_id) === userId)
    const requests = await Promise.all(ownedTeams.map(team => capture(async () => array(await getJoinRequests(team.id)))))
    if (requests.some(result => result.error)) errors.requests = 'Join requests could not be loaded.'
    else pendingRequests = requests.flatMap(result => result.data).filter(request => request.status === 'pending').length
  } else errors.teams = teamsResult.error || 'Team memberships are unavailable.'
  return {
    profile: profileResult.data, profileSkills: skillsResult.data,
    myTeams, pendingRequests, recommended: recommendationsResult.data, errors,
  }
}
