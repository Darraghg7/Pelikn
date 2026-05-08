// Temporary preview page — remove before shipping
import React, { useCallback } from 'react'

const SVG_PATHS = [
  "M111.581 104.182C96.2532 104.543 80.9327 105.088 65.6202 105.829C60.5271 106.056 45.127 107.88 41.575 105.113C40.7355 102.743 40.8666 103.955 41.3785 101.335C43.6299 98.8182 47.2266 98.3284 50.4259 98.659C63.5708 100.006 131.793 91.8746 139.38 94.6178C143.225 99.2529 133.006 106.588 129.368 111.762C114.802 132.477 110.197 170.39 77.5307 168.731C49.3708 165.694 45.8813 136.75 46.7483 115.308C70.6601 112.405 93.878 108.474 117.612 105.315C116.161 104.28 113.504 104.335 111.581 104.182Z",
  "M148.644 51.1993C183.239 49.7481 187.978 90.0071 164.264 109.344C142.392 127.174 130.764 152.291 163.008 168.658L160.027 168.645C139.961 168.474 133.495 157.422 134.31 138.44C137.83 118.498 152.458 110.25 164.662 95.8485C177.496 80.4735 167.956 55.9997 146.305 60.1389C135.522 62.1963 128.977 74.4423 123.111 82.935C119.461 82.935 115.959 83.1248 112.322 83.3085C122.658 68.6928 129.24 54.0955 148.644 51.1993Z"
]

function IconA({ run }) {
  return (
    <div key={run} style={{
      animation: 'icon-a-in 0.8s 0.15s cubic-bezier(.22,.9,.28,1) both',
    }}>
      <svg width={96} height={96} viewBox="0 0 218.749 224.045" style={{ display: 'block', overflow: 'visible' }}>
        {SVG_PATHS.map((d, i) => <path key={i} d={d} fill="#fff" />)}
      </svg>
    </div>
  )
}

function IconB({ run }) {
  return (
    <div key={run} style={{ position: 'relative', animation: 'icon-b-rise 0.5s 0.1s cubic-bezier(.22,.9,.28,1) both' }}>
      {/* glow burst */}
      <div style={{
        position: 'absolute', inset: -32,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(140,220,170,.6) 0%, transparent 70%)',
        animation: 'icon-b-glow 0.9s 0.55s ease-out both',
        pointerEvents: 'none',
      }} />
      <svg width={96} height={96} viewBox="0 0 218.749 224.045" style={{ display: 'block', overflow: 'visible' }}>
        {SVG_PATHS.map((d, i) => (
          <path key={i} d={d}
            style={{
              fill: 'rgba(255,255,255,0)',
              stroke: '#fff',
              strokeWidth: 5,
              strokeLinejoin: 'round',
              strokeLinecap: 'round',
              strokeDasharray: i === 0 ? 600 : 500,
              strokeDashoffset: i === 0 ? 600 : 500,
              animation: [
                `icon-b-draw ${i === 0 ? '0.65s' : '0.55s'} ${i === 0 ? '0.15s' : '0.28s'} cubic-bezier(.4,0,.2,1) forwards`,
                `icon-b-fill 0.35s 0.75s ease forwards`,
              ].join(', '),
            }}
          />
        ))}
      </svg>
    </div>
  )
}

function IconC({ run }) {
  return (
    <div key={run} style={{ position: 'relative', animation: 'icon-c-drop 0.7s 0.1s cubic-bezier(.34,1.56,.64,1) both' }}>
      {[0, 1].map(i => (
        <div key={i} style={{
          position: 'absolute', inset: -16,
          border: `${i === 0 ? 2 : 1.5}px solid rgba(255,255,255,${i === 0 ? .55 : .28})`,
          borderRadius: '50%',
          animation: `icon-c-ripple 0.75s ${i === 0 ? '0.6s' : '0.72s'} ease-out both`,
          pointerEvents: 'none',
        }} />
      ))}
      <svg width={96} height={96} viewBox="0 0 218.749 224.045"
        style={{
          display: 'block', overflow: 'visible',
          WebkitMaskImage: 'linear-gradient(to top, black 0%, black 100%, transparent 100%)',
          WebkitMaskSize: '100% 200%',
          WebkitMaskPosition: '0% 100%',
          maskImage: 'linear-gradient(to top, black 0%, black 100%, transparent 100%)',
          maskSize: '100% 200%',
          maskPosition: '0% 100%',
          animation: 'icon-c-fill 0.6s 0.5s cubic-bezier(.4,0,.2,1) forwards',
        }}>
        {SVG_PATHS.map((d, i) => <path key={i} d={d} fill="#fff" />)}
      </svg>
    </div>
  )
}

const CARDS = [
  { id: 'a', label: 'Current', sub: 'Scale + fade',      Icon: IconA },
  { id: 'b', label: 'Option B', sub: 'Stroke draws on → floods to fill + glow burst', Icon: IconB },
  { id: 'c', label: 'Option C', sub: 'Drops in from above + ripple rings on landing',  Icon: IconC },
]

export default function IconPreviewPage() {
  const [runs, setRuns] = React.useState({ a: 0, b: 0, c: 0 })
  const replay = useCallback((id, e) => {
    e.stopPropagation()
    setRuns(r => ({ ...r, [id]: r[id] + 1 }))
  }, [])

  return (
    <>
      <style>{`
        @keyframes icon-a-in {
          from { transform: scale(0.75); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        @keyframes icon-b-rise {
          from { transform: translateY(18px) scale(.92); opacity: 0; }
          to   { transform: translateY(0)    scale(1);   opacity: 1; }
        }
        @keyframes icon-b-glow {
          0%   { opacity: 0; transform: scale(.4); }
          35%  { opacity: 1; transform: scale(1.15); }
          100% { opacity: 0; transform: scale(1.7); }
        }
        @keyframes icon-b-draw { to { stroke-dashoffset: 0; } }
        @keyframes icon-b-fill {
          from { fill: rgba(255,255,255,0); stroke-width: 5; }
          to   { fill: rgba(255,255,255,1); stroke-width: 0; }
        }
        @keyframes icon-c-drop {
          from { transform: translateY(-34px) scale(.85); opacity: 0; }
          to   { transform: translateY(0)     scale(1);   opacity: 1; }
        }
        @keyframes icon-c-ripple {
          0%   { opacity: 1; transform: scale(.65); }
          100% { opacity: 0; transform: scale(1.9); }
        }
        @keyframes icon-c-fill {
          from { -webkit-mask-position: 0% 100%; mask-position: 0% 100%; }
          to   { -webkit-mask-position: 0%   0%; mask-position: 0%   0%; }
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: '#0f1a17',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 20px 80px',
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        color: '#fff',
      }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.18em', textTransform: 'uppercase', opacity: .4, marginBottom: 6 }}>
          Icon Animation Options
        </p>
        <p style={{ fontSize: 13, opacity: .3, marginBottom: 48 }}>Hit Replay to watch again</p>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          {CARDS.map(({ id, label, sub, Icon }) => (
            <div key={id} style={{
              width: 190,
              background: 'radial-gradient(120% 80% at 50% 35%, #2D4F45 0%, #2A4A40 100%)',
              borderRadius: 28,
              padding: '44px 20px 28px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              border: '1.5px solid rgba(255,255,255,.09)',
              overflow: 'hidden',
              position: 'relative',
            }}>
              <Icon run={runs[id]} />
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', opacity: .55, marginTop: 12 }}>
                {label}
              </p>
              <p style={{ fontSize: 10, opacity: .3, textAlign: 'center', lineHeight: 1.5, maxWidth: 140 }}>
                {sub}
              </p>
              <button
                onClick={e => replay(id, e)}
                style={{
                  marginTop: 6,
                  fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase',
                  background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff',
                  padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
                }}>
                Replay
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
