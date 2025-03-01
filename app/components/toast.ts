import type { Toast } from '~/utils/toast.server'
import { useEffect, useRef } from 'react'
import { toast as showToast } from 'sonner'

export function useToast(toast?: Toast | null) {
  const timeoutRef = useRef(0)

  useEffect(() => {
    if (toast) {
      timeoutRef.current = window.setTimeout(() => {
        showToast[toast.type](toast.title, {
          id: toast.id,
          description: toast.description,
        })
      }, 0)
    }

    return () => clearTimeout(timeoutRef.current)
  }, [toast])
}
