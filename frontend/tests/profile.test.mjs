import test from 'node:test'
import assert from 'node:assert/strict'
import { getProfileCompletion, groupProfileSkills, safeExternalURL } from '../src/utils/profile.js'

test('profile completion uses seven disclosed essentials and keeps showcase optional', () => {
  const profile = {
    avatar_url: '/uploads/avatars/user-1.png',
    bio: 'I build accessible interfaces.',
    experience_level: 'Intermediate',
    preferred_role: 'Frontend Developer',
    availability: 'weekend',
    project_interest: 'Hackathon',
  }
  const complete = getProfileCompletion(profile, [{ id: 1 }])
  assert.equal(complete.percent, 100)
  assert.equal(complete.total, 7)
  assert.equal(complete.checks.some(item => /portfolio|achievement/i.test(item.label)), false)

  const incomplete = getProfileCompletion({ ...profile, avatar_url: '', availability: ' ' }, [])
  assert.equal(incomplete.percent, 57)
  assert.deepEqual(incomplete.missing.map(item => item.label), ['Profile photo', 'Availability', 'At least one skill'])
  assert.equal(getProfileCompletion(null, []), null)
})

test('skills group by real categories with a neutral fallback', () => {
  const groups = groupProfileSkills([{ id: 1, name: 'React', category: 'Technical' }, { id: 2, name: 'Mentoring', category: '' }])
  assert.deepEqual(Object.keys(groups), ['Technical', 'Other'])
  assert.equal(groups.Other[0].name, 'Mentoring')
})

test('showcase links accept only public HTTP(S) URLs without credentials', () => {
  assert.equal(safeExternalURL('https://example.com/project'), 'https://example.com/project')
  assert.equal(safeExternalURL('javascript:alert(1)'), '')
  assert.equal(safeExternalURL('https://user:secret@example.com'), '')
  assert.equal(safeExternalURL('ftp://example.com/file'), '')
  assert.equal(safeExternalURL('not a link'), '')
})
