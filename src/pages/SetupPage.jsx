import React from 'react'

const steps = [
  {
    n: '1',
    title: 'Create a Supabase project',
    body: (
      <>
        Go to{' '}
        <a href="https://supabase.com" target="_blank" rel="noreferrer" className="underline underline-offset-2">
          supabase.com
        </a>
        , create a free project, then open the <strong>SQL Editor</strong> and run the contents of{' '}
        <code className="font-mono text-sm bg-charcoal/10 px-1 rounded">supabase/migrations/001_initial_schema.sql</code>.
      </>
    ),
  },
  {
    n: '2',
    title: 'Add your .env file',
    body: (
      <>
        Copy <code className="font-mono text-sm bg-charcoal/10 px-1 rounded">.env.example</code> to{' '}
        <code className="font-mono text-sm bg-charcoal/10 px-1 rounded">.env</code> and fill in your project URL and
        anon key from <strong>Supabase → Settings → API</strong>.
        <pre className="mt-3 text-xs bg-charcoal text-cream rounded-xl p-4 overflow-x-auto leading-relaxed">{`VITE_SUPABASE_URL=https://xxxx.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJ...`}</pre>
      </>
    ),
  },
  {
    n: '3',
    title: 'Restart the dev server',
    body: (
      <>
        Stop the server, then run{' '}
        <code className="font-mono text-sm bg-charcoal/10 px-1 rounded">npm run dev</code> again. The app will load
        normally once the environment variables are detected.
      </>
    ),
  },
]

export default function SetupPage() {
  return (
    <div className="min-h-dvh bg-surface flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-charcoal mb-1">SafeServ</h1>
          <p className="text-charcoal/50 text-sm">Setup required</p>
        </div>

        <div className="bg-white/70 rounded-3xl p-6 shadow-sm border border-charcoal/10 mb-6">
          <p className="text-sm text-charcoal/70 mb-5">
            Supabase credentials are not configured yet. Follow these steps to get the app running:
          </p>

          <div className="flex flex-col gap-6">
            {steps.map((s) => (
              <div key={s.n} className="flex gap-4">
                <div className="shrink-0 w-7 h-7 rounded-full bg-charcoal text-cream flex items-center justify-center text-sm font-semibold mt-0.5">
                  {s.n}
                </div>
                <div>
                  <p className="font-medium text-charcoal mb-1">{s.title}</p>
                  <p className="text-sm text-charcoal/60 leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-charcoal/40">
          After setup, this page will be replaced by the login screen automatically.
        </p>
      </div>
    </div>
  )
}
