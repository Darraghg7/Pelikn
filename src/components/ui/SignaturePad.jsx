import React, { useRef, useEffect, useState } from 'react'

/**
 * Canvas-based signature pad.
 * Props:
 *   onChange(dataUrl | null)  — called after each stroke ends, null after clear
 *   disabled                  — renders as a static preview if true
 *   value                     — existing signature data URL (for read-only display)
 */
export default function SignaturePad({ onChange, disabled = false, value = null }) {
  const canvasRef    = useRef(null)
  const [drawing, setDrawing]         = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  // When a value is provided (read-only mode), draw it onto the canvas
  useEffect(() => {
    if (!value || !canvasRef.current) return
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      const ctx    = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    }
    img.src = value
    setHasSignature(true)
  }, [value])

  function getPos(e) {
    const rect  = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width  / rect.width
    const scaleY = canvasRef.current.height / rect.height
    const touch  = e.touches ? e.touches[0] : e
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top)  * scaleY,
    }
  }

  const startDraw = (e) => {
    if (disabled) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    ctx.strokeStyle = '#1a1a18'
    ctx.lineWidth   = 2
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setDrawing(true)
  }

  const draw = (e) => {
    if (!drawing || disabled) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  const endDraw = () => {
    if (!drawing) return
    setDrawing(false)
    setHasSignature(true)
    onChange?.(canvasRef.current.toDataURL())
  }

  const clear = (e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
    onChange?.(null)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className={`relative border rounded-lg overflow-hidden ${disabled ? 'bg-white border-charcoal/10' : 'bg-white border-charcoal/20'}`}>
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          className={`w-full block ${disabled ? '' : 'touch-none cursor-crosshair'}`}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasSignature && !disabled && (
          <p className="absolute inset-0 flex items-center justify-center text-charcoal/25 text-sm pointer-events-none select-none">
            Sign here
          </p>
        )}
      </div>
      {hasSignature && !disabled && (
        <button
          onClick={clear}
          className="text-[11px] text-charcoal/40 hover:text-danger transition-colors self-start"
        >
          Clear signature
        </button>
      )}
    </div>
  )
}
