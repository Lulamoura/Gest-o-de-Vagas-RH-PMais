import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import pb from '@/lib/pocketbase/client'
import { getDepartamentos } from '@/services/departamentos'
import {
  resendRemoteAccessCode,
  startAccessLogin,
  validateAccessSession,
  verifyRemoteAccessCode,
} from '@/services/access-control'
import type { RemoteMfaChallengeResponse } from '@/services/access-control'
import { isRhDepartmentName } from '@/lib/auth'
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
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: unknown; challenge?: RemoteMfaChallengeResponse }>
  verifyRemoteCode: (challengeId: string, code: string) => Promise<{ error: unknown }>
  resendRemoteCode: (
    challengeId: string,
  ) => Promise<{ error: unknown; challenge?: RemoteMfaChallengeResponse }>
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
  const isSigningInRef = useRef(false)

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, record) => {
      const validUser = pb.authStore.isValid ? (record as unknown as UserRecord) : null
      setUser(validUser)
      setIsAuthenticated(pb.authStore.isValid)
    })

    if (pb.authStore.isValid) {
      validateAccessSession()
        .then((record) =>
          pb.collection('users').getOne(record.id, {
            expand: 'departamento',
          }),
        )
        .then((record) => {
          setUser(record as unknown as UserRecord)
        })
        .catch(() => {
          if (!isSigningInRef.current) {
            pb.authStore.clear()
          }
        })
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

  const loadAuthenticatedUser = async (recordId: string) => {
    const record = await pb.collection('users').getOne(recordId, { expand: 'departamento' })
    setUser(record as unknown as UserRecord)
    setIsAuthenticated(true)
  }

  const signIn = async (email: string, password: string) => {
    isSigningInRef.current = true
    try {
      const response = await startAccessLogin(email, password)
      if (response.type === 'remote_mfa_required') {
        return { error: null, challenge: response }
      }
      await loadAuthenticatedUser(response.record.id)
      return { error: null }
    } catch (error) {
      pb.authStore.clear()
      setUser(null)
      return { error }
    } finally {
      isSigningInRef.current = false
    }
  }

  const verifyRemoteCode = async (challengeId: string, code: string) => {
    isSigningInRef.current = true
    try {
      const response = await verifyRemoteAccessCode(challengeId, code)
      await loadAuthenticatedUser(response.record.id)
      return { error: null }
    } catch (error) {
      pb.authStore.clear()
      setUser(null)
      return { error }
    } finally {
      isSigningInRef.current = false
    }
  }

  const resendRemoteCode = async (challengeId: string) => {
    try {
      const challenge = await resendRemoteAccessCode(challengeId)
      return { error: null, challenge }
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
  const isRH = isRhDepartmentName(user?.expand?.departamento?.nome)
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
        verifyRemoteCode,
        resendRemoteCode,
        signOut,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
