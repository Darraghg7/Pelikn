import '@testing-library/jest-dom'
import { supabase } from './lib/supabase'

// ── No realtime sockets in unit tests ───────────────────────────────────────
// useTodaySummary joins a realtime channel on mount, and subscribing opens a
// real WebSocket. Under Node the socket comes from undici, whose Event class is
// not the jsdom Event the environment installs, so delivering the open event
// throws "The 'event' argument must be an instance of Event. Received an
// instance of Event" — asynchronously, outside any test.
//
// That failure is invisible locally and fails CI: every test still passes, the
// run just exits non-zero on uncaught exceptions. Stubbing here rather than in
// one test file means a future test that mounts a subscribing hook cannot
// reintroduce it.
//
// Assigned rather than installed with vi.spyOn deliberately: a test's
// vi.restoreAllMocks() restores whatever was on the object when it spied, so
// this stub survives instead of handing back the socket-opening original.
// Tests that need to observe channel behaviour spy over this as normal.
const noopChannel = {
  on() { return noopChannel },
  subscribe() { return noopChannel },
  unsubscribe() { return Promise.resolve('ok') },
}

supabase.channel = (() => noopChannel) as unknown as typeof supabase.channel
supabase.removeChannel = (async () => 'ok') as unknown as typeof supabase.removeChannel
