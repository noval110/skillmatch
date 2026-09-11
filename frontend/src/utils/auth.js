export function getTokenPayload() {
  const token = localStorage.getItem('token')
  if (!token) return null
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(decodeURIComponent(escape(atob(payload))))
  } catch {
    return null
  }
}

export function getCurrentUserId() {
  return Number(getTokenPayload()?.user_id) || null
}

export function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('currentUser')
}
