export const milestoneStatusLabel = status => ({
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
})[status] || 'Not started'

const calendarKey = date => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function milestoneDeadlineState(milestone, now = new Date()) {
  if (milestone.status === 'completed') return 'completed'
  if (!milestone.due_date) return 'no_deadline'
  const today = calendarKey(now)
  if (milestone.due_date < today) return 'overdue'
  const [year, month, day] = milestone.due_date.split('-').map(Number)
  const [currentYear, currentMonth, currentDay] = today.split('-').map(Number)
  const days = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(currentYear, currentMonth - 1, currentDay)) / 86400000)
  return days <= 3 ? 'due_soon' : 'upcoming'
}

export function formatMilestoneDate(value, locale) {
  if (!value) return 'No deadline'
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day))
}

export function normalizeMilestonePayload(value) {
  const milestones = Array.isArray(value?.milestones) ? value.milestones : []
  const summary = value?.summary && typeof value.summary === 'object' ? value.summary : {}
  const progress = Number.isFinite(summary.overall_progress) ? summary.overall_progress : null
  return {
    milestones,
    can_manage: value?.can_manage === true,
    summary: {
      total: Number.isFinite(summary.total) ? summary.total : milestones.length,
      completed: Number.isFinite(summary.completed) ? summary.completed : milestones.filter(item => item.status === 'completed').length,
      in_progress: Number.isFinite(summary.in_progress) ? summary.in_progress : milestones.filter(item => item.status === 'in_progress').length,
      not_started: Number.isFinite(summary.not_started) ? summary.not_started : milestones.filter(item => item.status === 'not_started').length,
      overall_progress: progress,
      next_milestone: summary.next_milestone || milestones.find(item => item.status !== 'completed') || null,
    },
  }
}

export function milestoneWritePayload(milestone) {
  let status = milestone.status || 'not_started'
  let progress = Math.min(100, Math.max(0, Number(milestone.progress) || 0))
  if (status === 'completed' || progress === 100) {
    status = 'completed'
    progress = 100
  } else if (status === 'not_started' && progress > 0) status = 'in_progress'
  return {
    title: milestone.title.trim(),
    description: milestone.description.trim(),
    due_date: milestone.due_date || null,
    status,
    progress,
  }
}
