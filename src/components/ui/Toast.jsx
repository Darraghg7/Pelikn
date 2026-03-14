import React, { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  const styles = {
    success: 'bg-charcoal text-cream',
    error:   'bg-danger text-white',
    warning: 'bg-warning text-white',
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-20 sm:bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-5 py-3 rounded-2xl shadow-lg text-sm font-medium whitespace-nowrap animate-fade-in ${styles[t.type] ?? styles.success}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
