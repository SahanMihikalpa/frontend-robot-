import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { getRoleHome, getStoredUser } from '../lib/session'

export default function Dashboard() {
  const router = useRouter()

  useEffect(() => {
    const role = getStoredUser()?.role
    router.replace(getRoleHome(role))
  }, [router])

  return null
}
