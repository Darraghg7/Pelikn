// Origins allowed to call edge functions from a browser. Mirrors the list in
// pin-login/index.ts. The first entry is the live site and is also the
// fallback Access-Control-Allow-Origin for anything not on the list.
// pelikn.app no longer resolves; it stays only so nothing breaks if it returns.

const DEV_ORIGIN = Deno.env.get('DEV_ORIGIN')

export const ALLOWED_ORIGINS = [
  'https://get-pelikn.com',
  'https://pelikn.app',
  'https://pelikn.vercel.app',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost:5173',
  'http://localhost:4173',
  ...(DEV_ORIGIN ? [DEV_ORIGIN] : []),
]

// Vercel preview deploys (one per branch), pinned to this Vercel team's
// suffix so another account's "pelikn-…" project can't match.
const PREVIEW_ORIGIN = /^https:\/\/pelikn-[a-z0-9-]+-darraghguy1-4932s-projects\.vercel\.app$/

export const originAllowed = (origin: string) =>
  ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin)

// Value for the Access-Control-Allow-Origin header on this request.
export const allowOrigin = (req: Request) => {
  const origin = req.headers.get('origin') ?? ''
  return originAllowed(origin) ? origin : ALLOWED_ORIGINS[0]
}
