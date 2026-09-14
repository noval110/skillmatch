import test from 'node:test'
import assert from 'node:assert/strict'
import { getProfileReadiness, getCompetitionJourney } from '../src/utils/dashboard.js'
import { matchesTeamQuery } from '../src/utils/teamSearch.js'

const profile = { name: 'Test student', bio: 'Learning', experience_level: 'beginner', preferred_role: 'Researcher', availability: 'weekend', project_interest: 'Research' }
test('profile completeness distinguishes failed data from an incomplete profile', () => {
  assert.equal(getProfileReadiness(null, []), null)
  assert.equal(getProfileReadiness(profile, null), null)
  assert.equal(getProfileReadiness(profile, []).percent, 86)
  assert.equal(getProfileReadiness(profile, [{ id: 1 }]).percent, 100)
  assert.equal(getProfileReadiness({ ...profile, bio: '   ' }, []).completed, 5)
})
test('journey does not invent collaboration or competition completion', () => {
  const ready = getProfileReadiness(profile, [{ id: 1 }])
  const member = getCompetitionJourney(ready, true)
  assert.deepEqual(member.map(step => step.complete), [true, true, false, false])
  assert.equal(member[2].current, true)
  assert.equal(getCompetitionJourney(ready, false)[1].current, true)
  assert.equal(getCompetitionJourney(ready, null)[1].complete, false)
  assert.equal(getCompetitionJourney(null, true)[0].current, true)
})
test('global search matches real team skills and competition fields', () => {
  const team = { name: 'Ruang Riset', competition_type: 'Research / KTI', competition_category: 'Research', roles: [{ role_name: 'Analyst', skills: [{ skill_name: 'Python' }] }] }
  for (const query of [' ruang ', 'KTI', 'research', 'PYTHON', 'analyst', '']) assert.equal(matchesTeamQuery(team, query), true)
  assert.equal(matchesTeamQuery(team, 'React'), false)
  assert.equal(matchesTeamQuery({ name: 'Empty roles' }, 'Python'), false)
})
