import { skillCategory } from '../config/competitions.js'

export const availabilityLabels = {
  weekday: 'Available on weekdays',
  weekend: 'Available on weekends',
  flexible: 'Flexible availability',
}

export function titleCase(value = '') {
  return value.trim().replace(/\b\w/g, character => character.toUpperCase())
}

const present = value => typeof value === 'string' ? Boolean(value.trim()) : Boolean(value)

// Portfolio and achievements are deliberately optional: this score measures the
// seven profile basics that make recommendations and teammate evaluation useful.
export function getProfileCompletion(profile, skills) {
  if (!profile || !Array.isArray(skills)) return null
  const checks = [
    ['Profile photo', profile.avatar_url || profile.profile_photo_url],
    ['Bio', profile.bio],
    ['Experience level', profile.experience_level],
    ['Preferred role', profile.preferred_role],
    ['Availability', profile.availability],
    ['Competition interest', profile.project_interest],
    ['At least one skill', skills.length > 0],
  ].map(([label, value]) => ({ label, complete: present(value) }))
  const completed = checks.filter(item => item.complete).length
  return {
    checks,
    completed,
    total: checks.length,
    missing: checks.filter(item => !item.complete),
    percent: Math.round(completed / checks.length * 100),
  }
}

export function groupProfileSkills(skills = []) {
  return skills.reduce((groups, skill) => {
    const category = skillCategory(skill)
    if (!groups[category]) groups[category] = []
    groups[category].push(skill)
    return groups
  }, {})
}

export function formatProfileDate(value) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function safeExternalURL(value = '') {
  if (!value) return ''
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? value : ''
  } catch {
    return ''
  }
}
