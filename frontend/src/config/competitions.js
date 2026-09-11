import { Code, GraduationCap, BriefcaseBusiness, Microscope, Video, Palette, Trophy, Gamepad2, Shapes } from 'lucide-react'

// Suggestions only: custom competition types, roles and skill combinations remain valid.
export const competitionCategories = [
  { name: 'Technology', icon: Code, tone: 'technology', types: ['Hackathon', 'Web Development', 'Data Competition', 'Robotics'] },
  { name: 'Academic', icon: GraduationCap, tone: 'academic', types: ['Debate', 'Essay Competition', 'Public Speaking'] },
  { name: 'Business', icon: BriefcaseBusiness, tone: 'business', types: ['Business Case', 'Marketing Competition', 'Startup Competition'] },
  { name: 'Research', icon: Microscope, tone: 'research', types: ['Scientific Writing', 'KTI', 'Research Competition'] },
  { name: 'Creative', icon: Video, tone: 'creative', types: ['Video Competition', 'Photography'] },
  { name: 'Design', icon: Palette, tone: 'design', types: ['UI/UX Competition', 'Poster Design'] },
  { name: 'Sports', icon: Trophy, tone: 'sports', types: ['Sports Competition', 'Other'] },
  { name: 'Esports', icon: Gamepad2, tone: 'esports', types: ['Mobile Legends', 'Valorant', 'Other'] },
  { name: 'Other', icon: Shapes, tone: 'other', types: ['Other'] },
]

export const skillCategories = ['Technical', 'Communication', 'Research', 'Business', 'Design', 'Creative', 'Leadership', 'Language', 'Strategy', 'Other']
export const categoryFor = (name) => competitionCategories.find(category => category.name === name) || competitionCategories.at(-1)
export const typesFor = (category) => category ? categoryFor(category).types : [...new Set(competitionCategories.flatMap(item => item.types))]
export const skillCategory = (skill) => skill.category?.trim() || 'Other'

const rolePresets = {
  Hackathon: ['Frontend Developer', 'Backend Developer', 'UI/UX Designer', 'AI/ML Engineer', 'Product Manager', 'Pitch Presenter'],
  Debate: ['First Speaker', 'Second Speaker', 'Third Speaker', 'Researcher', 'Case Builder'],
  'Business Case': ['Business Analyst', 'Market Researcher', 'Financial Analyst', 'Strategist', 'Presenter', 'Pitch Deck Designer'],
  'Scientific Writing': ['Researcher', 'Academic Writer', 'Data Analyst', 'Editor', 'Presenter'],
  'Video Competition': ['Director', 'Scriptwriter', 'Video Editor', 'Cinematographer', 'Voice Over Talent', 'Motion Designer'],
  'Poster Design': ['Graphic Designer', 'Illustrator', 'Copywriter', 'Researcher'],
  Esports: ['Team Captain', 'Player', 'Analyst', 'Strategist'],
}
export function rolesFor(type, category) {
  const alias = { KTI: 'Scientific Writing', 'Research Competition': 'Scientific Writing', 'Web Development': 'Hackathon', 'UI/UX Competition': 'Poster Design' }
  return rolePresets[alias[type] || type] || (category === 'Esports' ? rolePresets.Esports : [])
}

const skillPresets = {
  'Frontend Developer': ['Frontend Development', 'React', 'JavaScript', 'API Integration'],
  'Backend Developer': ['Backend Development', 'Go', 'PostgreSQL', 'Git'],
  'UI/UX Designer': ['Figma', 'UI Design', 'UX Research'],
  'AI/ML Engineer': ['Python', 'Data Analysis', 'Research'],
  'Product Manager': ['Project Management', 'Business Analysis', 'Team Communication'],
  'Pitch Presenter': ['Pitching', 'Presentation', 'Public Speaking'],
  'First Speaker': ['Public Speaking', 'Argumentation', 'Case Building', 'Research'],
  'Second Speaker': ['Public Speaking', 'Argumentation', 'Rebuttal', 'Critical Thinking'],
  'Third Speaker': ['Public Speaking', 'Rebuttal', 'Analytical Thinking'],
  'Case Builder': ['Case Building', 'Research', 'Argumentation'],
  Researcher: ['Research', 'Literature Review', 'Critical Thinking'],
  'Business Analyst': ['Business Analysis', 'Market Research', 'Strategy', 'Presentation'],
  'Market Researcher': ['Market Research', 'Competitor Analysis', 'Data Analysis'],
  'Financial Analyst': ['Financial Analysis', 'Business Analysis', 'Presentation'],
  Strategist: ['Strategy', 'Analytical Thinking', 'Decision Making'],
  Presenter: ['Presentation', 'Public Speaking', 'Storytelling'],
  'Pitch Deck Designer': ['Figma', 'Branding', 'Storytelling'],
  'Academic Writer': ['Academic Writing', 'Research', 'Literature Review'],
  'Data Analyst': ['Data Analysis', 'Analytical Thinking', 'Python'],
  Editor: ['Academic Writing', 'Citation Management', 'Critical Thinking'],
  Director: ['Leadership', 'Storytelling', 'Cinematography'],
  Scriptwriter: ['Scriptwriting', 'Storytelling', 'Copywriting'],
  'Video Editor': ['Video Editing', 'Storytelling'],
  Cinematographer: ['Cinematography', 'Photography'],
  'Voice Over Talent': ['Voice Over', 'Public Speaking'],
  'Motion Designer': ['Motion Graphics', 'Video Editing'],
  'Graphic Designer': ['Poster Design', 'Typography', 'Photoshop'],
  Illustrator: ['Adobe Illustrator', 'Typography'],
  Copywriter: ['Copywriting', 'Storytelling'],
  'Team Captain': ['Leadership', 'Team Coordination', 'Game Strategy'],
  Player: ['Game Strategy', 'Team Communication'],
  Analyst: ['Game Strategy', 'Analytical Thinking'],
}
export const skillsForRole = (role, category) => category === 'Esports' && role === 'Strategist' ? ['Game Strategy', 'Analytical Thinking'] : skillPresets[role] || []

// Select the strongest available team in each category before filling remaining slots.
export function diverseTeams(teams, limit = 3) {
  const sorted = [...teams].sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1))
  const chosen = [], seen = new Set()
  for (const team of sorted) {
    const category = team.competition_category || 'Other'
    if (!seen.has(category) && chosen.length < limit) { chosen.push(team); seen.add(category) }
  }
  for (const team of sorted) if (chosen.length < limit && !chosen.includes(team)) chosen.push(team)
  return chosen
}
