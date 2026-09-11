import { useSyncExternalStore } from 'react'

// Follow the same stored-session state as ProtectedRoute without changing the JWT.
const getSnapshot = () => Boolean(localStorage.getItem('token'))
const subscribe = (onChange) => {
  window.addEventListener('storage', onChange)
  window.addEventListener('focus', onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener('focus', onChange)
  }
}

export default function useAuthenticated() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
