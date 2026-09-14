export const notificationTarget = item => {
  if (item.related_conversation_id) return `/messages/${item.related_conversation_id}`
  if (item.related_team_id) return `/teams/${item.related_team_id}${item.type?.startsWith('milestone_') ? '?tab=milestones' : ''}`
  if (item.related_user_id) return `/users/${item.related_user_id}`
  return null
}
