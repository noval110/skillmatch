const API_URL = import.meta.env.VITE_API_URL?.replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function request(path, options = {}) {
  const { method = 'GET', body, auth = true, headers = {}, errorMessage = 'Permintaan gagal', formData = false } = options
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body !== undefined && !formData ? { 'Content-Type': 'application/json' } : {}),
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: formData ? body : JSON.stringify(body) } : {}),
  })

  const data = await response.json().catch(() => ({}))
  if (response.status === 401 && auth) {
    localStorage.removeItem('token')
    if (window.location.pathname !== '/login') window.location.assign('/login')
  }
  if (!response.ok) throw new ApiError(data.error || data.message || errorMessage, response.status)
  return data
}

export const loginUser = (email, password) => request('/login', { method: 'POST', body: { email, password }, auth: false })
export const registerUser = (name, email, password, experienceLevel) => request('/register', {
  method: 'POST',
  auth: false,
  errorMessage: 'Failed to create user',
  body: {
    name,
    email,
    password,
    experience_level: experienceLevel,
  },
})
export const getProfile = () => request('/profile')
export const createConversation = (userId) => request('/conversations', { method: 'POST', body: { user_id: Number(userId) } })
export const getConversations = (offset = 0) => request(`/conversations?offset=${offset}`)
export const getConversation = (id) => request(`/conversations/${id}`)
export const getMessages = (id, cursors = {}) => request(`/conversations/${id}/messages?${new URLSearchParams(cursors)}`)
export const sendMessage = (id, body) => request(`/conversations/${id}/messages`, { method: 'POST', body })
export const readConversation = (id, lastMessageId) => request(`/conversations/${id}/read`, { method: 'PUT', body: { last_message_id: lastMessageId } })
export const getShowcase = () => request('/profile/showcase')
export const saveShowcaseItem = (kind, id, body) => request(`/profile/${kind}${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body })
export const deleteShowcaseItem = (kind, id) => request(`/profile/${kind}/${id}`, { method: 'DELETE' })
export const getNotifications = (before) => request(`/notifications${before ? `?before=${before}` : ''}`)
export const getNotificationCount = () => request('/notifications/unread-count')
export const readNotification = (id) => request(`/notifications/${id}/read`, { method: 'PUT' })
export const readAllNotifications = () => request('/notifications/read-all', { method: 'PUT' })
export const getPublicProfile = (userId) => request(`/users/${encodeURIComponent(userId)}/profile`)
export const updateProfile = (body) => request('/profile', { method: 'PUT', body })
export const uploadProfilePhoto = (photo) => {
  const body = new FormData()
  body.append('photo', photo)
  return request('/profile/photo', { method: 'POST', body, formData: true })
}

export const resolveMediaURL = (path) => {
  if (!path || /^(data:|blob:|https?:\/\/)/.test(path)) return path || ''
  return `${new URL(API_URL).origin}${path.startsWith('/') ? path : `/${path}`}`
}
export const getSkills = (category = '') => request(`/skills${category ? `?category=${encodeURIComponent(category)}` : ''}`, { auth: false })
export const getProfileSkills = () => request('/profile/skills')
export const addProfileSkill = (body) => request('/profile/skills', { method: 'POST', body })
export const updateProfileSkill = (skillId, body) => request(`/profile/skills/${skillId}`, { method: 'PUT', body })
export const deleteProfileSkill = (skillId) => request(`/profile/skills/${skillId}`, { method: 'DELETE' })
export const getTeams = () => request('/teams', { auth: false })
export const getRecommendedTeams = () => request('/teams/recommended')
export const searchTeams = (filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => value && params.set(key, value))
  return request(`/teams/search?${params.toString()}`, { auth: false })
}
export const getTeam = (teamId) => request(`/teams/${teamId}`, { auth: false })
export const createTeam = (body) => request('/teams', { method: 'POST', body })
export const updateTeam = (teamId, body) => request(`/teams/${teamId}`, { method: 'PUT', body })
export const deleteTeam = (teamId) => request(`/teams/${teamId}`, { method: 'DELETE' })
export const joinTeam = (teamId, message) => request(`/teams/${teamId}/join`, { method: 'POST', body: { message } })
export const leaveTeam = (teamId) => request(`/teams/${teamId}/leave`, { method: 'DELETE' })
export const removeTeamMember = (teamId, userId) => request(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' })
export const getTeamRoles = (teamId) => request(`/teams/${teamId}/roles`, { auth: false })
export const createTeamRole = (teamId, roleName, experiencePreference = 'open') => request(`/teams/${teamId}/roles`, { method: 'POST', body: { role_name: roleName, experience_preference: experiencePreference } })
export const updateTeamRole = (teamId, roleId, status) => request(`/teams/${teamId}/roles/${roleId}`, { method: 'PUT', body: typeof status === 'string' ? { status } : status })
export const deleteTeamRole = (teamId, roleId) => request(`/teams/${teamId}/roles/${roleId}`, { method: 'DELETE' })
export const getRoleSkills = (teamId, roleId) => request(`/teams/${teamId}/roles/${roleId}/skills`, { auth: false })
export const addRoleSkill = (teamId, roleId, body) => request(`/teams/${teamId}/roles/${roleId}/skills`, { method: 'POST', body })
export const deleteRoleSkill = (teamId, roleId, skillId) => request(`/teams/${teamId}/roles/${roleId}/skills/${skillId}`, { method: 'DELETE' })
export const getRoleMatch = (teamId, roleId) => request(`/teams/${teamId}/roles/${roleId}/match`)
export const getJoinRequests = (teamId) => request(`/teams/${teamId}/join-requests`)
export const acceptJoinRequest = (requestId) => request(`/join-requests/${requestId}/accept`, { method: 'PUT' })
export const rejectJoinRequest = (requestId) => request(`/join-requests/${requestId}/reject`, { method: 'PUT' })

export default API_URL
