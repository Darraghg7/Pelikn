import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'

const nowLocal = () => format(new Date(), "yyyy-MM-dd'T'HH:mm")

/**
 * A datetime-local value that stays "now" until the user changes it.
 *
 * Forms used to capture the time once, when the page opened. Leave the fridge
 * form open for a minute and it warned the reading was a "past entry"; leave
 * it an hour and the reading was saved an hour early. Until the user edits
 * the field it keeps ticking, and `instant()` returns the real save time.
 */
export function useLiveDatetimeLocal() {
  const [value, setValue]   = useState(nowLocal)
  const [edited, setEdited] = useState(false)

  useEffect(() => {
    if (edited) return
    const id = setInterval(() => setValue(nowLocal()), 15_000)
    return () => clearInterval(id)
  }, [edited])

  const setByUser = useCallback((v) => { setValue(v); setEdited(true) }, [])
  const reset     = useCallback(() => { setValue(nowLocal()); setEdited(false) }, [])
  // The moment to record: what the user chose, or right now if they didn't.
  const instant   = useCallback(() => (edited ? new Date(value) : new Date()), [edited, value])

  return { value, setByUser, edited, reset, instant }
}
