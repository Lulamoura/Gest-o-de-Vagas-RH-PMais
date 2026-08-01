import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { getSystemParameters } from '@/services/system_parameters'
import { setOverdueThreshold } from '@/lib/vacancy-overdue'
import type { SystemParameterRecord } from '@/types'

interface SystemParametersContextType {
  parameters: SystemParameterRecord | null
  loading: boolean
  refresh: () => Promise<void>
}

const SystemParametersContext = createContext<SystemParametersContextType | undefined>(undefined)

export const useSystemParameters = () => {
  const context = useContext(SystemParametersContext)
  if (!context) {
    throw new Error('useSystemParameters must be used within SystemParametersProvider')
  }
  return context
}

export const SystemParametersProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth()
  const [parameters, setParameters] = useState<SystemParameterRecord | null>(null)
  const [loading, setLoading] = useState(true)

  const loadParameters = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    try {
      const data = await getSystemParameters()
      setParameters(data)
      if (data?.prazo_alerta_dias) {
        setOverdueThreshold(data.prazo_alerta_dias)
      }
    } catch {
      // Use default threshold (30)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    loadParameters()
  }, [loadParameters])

  useRealtime(
    'system_parameters',
    () => {
      loadParameters()
    },
    isAuthenticated,
  )

  return (
    <SystemParametersContext.Provider value={{ parameters, loading, refresh: loadParameters }}>
      {children}
    </SystemParametersContext.Provider>
  )
}
