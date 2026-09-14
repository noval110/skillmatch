// These are transparent completeness checks, not a backend readiness score.
export function getProfileReadiness(profile, skills) {
  if (!profile || !Array.isArray(skills)) return null
  const checks = [
    ['Name', profile.name], ['About you', profile.bio], ['Experience level', profile.experience_level],
    ['Preferred role', profile.preferred_role], ['Availability', profile.availability],
    ['Competition interests', profile.project_interest], ['At least one skill', skills.length > 0],
  ].map(([label, value]) => ({ label, complete: typeof value === 'string' ? Boolean(value.trim()) : Boolean(value) }))
  const completed = checks.filter(item => item.complete).length
  return { checks, completed, total: checks.length, percent: Math.round(completed / checks.length * 100) }
}

export function getCompetitionJourney(profileReadiness, hasTeam) {
  const profileComplete = profileReadiness?.percent === 100
  return [
    { title: 'Complete Profile', description: profileReadiness ? `${profileReadiness.completed} of ${profileReadiness.total} profile basics added` : 'Add your skills, interests, and availability', complete: profileComplete, current: !profileComplete },
    { title: 'Find Your Team', description: hasTeam ? 'You have a team to build with' : 'Discover people with a shared goal', complete: hasTeam === true, current: profileComplete && hasTeam === false },
    { title: 'Collaborate & Grow', description: hasTeam ? 'Connect with your team and plan your next step' : 'Work together and share knowledge', complete: false, current: profileComplete && hasTeam === true },
    { title: 'Compete & Make an Impact', description: 'Turn your preparation into real experience', complete: false, current: false },
  ]
}
