import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import pb from '@/lib/pocketbase/client'
import { getDepartamentos } from '@/services/departamentos'
import { UserRecord } from '@/types'

interface AuthContextType {
  user: UserRecord | null
  isAuthenticated: boolean
  isAdmin: boolean
  isOperator: boolean
  isSuperAdmin: boolean
  isRH: boolean
  canEditVacancy: boolean
  canManageUsers: boolean
  canIntegrateCandidate: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserRecord | null>(
    pb.authStore.isValid ? (pb.authStore.record as unknown as UserRecord) : null,
  )
  const [isAuthenticated, setIsAuthenticated] = useState(pb.authStore.isValid)
  const [loading, setLoading] = useState(true)
  const [dpDepartmentId, setDpDepartmentId] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, record) => {
      const validUser = pb.authStore.isValid ? (record as unknown as UserRecord) : null
      setUser(validUser)
      setIsAuthenticated(pb.authStore.isValid)
    })

    if (pb.authStore.isValid) {
      pb.collection('users')
        .authRefresh({ expand: 'departamento' })
        .then((res) => {
          setUser(res.record as unknown as UserRecord)
        })
        .catch(() => pb.authStore.clear())
        .finally(() => setLoading(false))
    } else {
      if (pb.authStore.record) pb.authStore.clear()
      setLoading(false)
    }
    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    getDepartamentos()
      .then((depts) => {
        const dpDept = depts.find((d) => d.nome === 'DP')
        if (dpDept) setDpDepartmentId(dpDept.id)
      })
      .catch(() => {})
  }, [isAuthenticated])

  const signIn = async (email: string, password: string) => {
    try {
      const authData = await pb.collection('users').authWithPassword(email, password, {
        expand: 'departamento',
      })
      setUser(authData.record as unknown as UserRecord)
      setIsAuthenticated(true)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const signOut = () => {
    pb.authStore.clear()
    setUser(null)
    setIsAuthenticated(false)
    setDpDepartmentId(null)
  }

  const isAdmin = user?.profile === 'admin'
  const isOperator = user?.profile === 'operator' || isAdmin
  const isSuperAdmin = user?.profile === 'superadmin'
  const isRH = user?.expand?.departamento?.nome === 'rh'
  const canEditVacancy = isAdmin || isSuperAdmin
  const canManageUsers = isAdmin || isSuperAdmin
  const canIntegrateCandidate =
    isAdmin ||
    isSuperAdmin ||
    (user?.profile === 'operator' &&
      !!dpDepartmentId &&
      !!user?.departamento &&
      user.departamento === dpDepartmentId)

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isAdmin,
        isOperator,
        isSuperAdmin,
        isRH,
        canEditVacancy,
        canManageUsers,
        canIntegrateCandidate,
        signIn,
        signOut,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
