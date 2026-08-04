import { useRef, useEffect } from 'react'
import { useRealtime } from '@/hooks/use-realtime'
import type { RecordModel } from 'pocketbase'

export function useDebouncedRealtime<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: () => void,
  delay: number = 500,
  enabled: boolean = true,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useRealtime<TRecord>(
    collectionName,
    () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        callbackRef.current()
      }, delay)
    },
    enabled,
  )

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])
}
