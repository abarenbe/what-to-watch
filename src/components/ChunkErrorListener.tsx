'use client'

import { useEffect } from 'react'

export function ChunkErrorListener() {
    useEffect(() => {
        const handleError = (e: ErrorEvent) => {
            // ChunkLoadError is the common name, but we check the message too
            if (e.message?.includes('Loading chunk') || e.message?.includes('ChunkLoadError')) {
                console.warn('ChunkLoadError detected, reloading page...')
                window.location.reload()
            }
        }

        const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
            if (e.reason?.name === 'ChunkLoadError' || e.reason?.message?.includes('Loading chunk')) {
                console.warn('Unhandled ChunkLoadError detected, reloading page...')
                window.location.reload()
            }
        }

        window.addEventListener('error', handleError)
        window.addEventListener('unhandledrejection', handleUnhandledRejection)

        return () => {
            window.removeEventListener('error', handleError)
            window.removeEventListener('unhandledrejection', handleUnhandledRejection)
        }
    }, [])

    return null
}
