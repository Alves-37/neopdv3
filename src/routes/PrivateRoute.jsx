import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function PrivateRoute() {
  const { isAuthenticated, autoLogin } = useAuth()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function check() {
      if (isAuthenticated) {
        setChecking(false)
        return
      }
      try {
        await autoLogin()
      } finally {
        if (!cancelled) setChecking(false)
      }
    }

    check()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, autoLogin])

  if (checking) return null
  if (!isAuthenticated) return null
  return <Outlet />
}
