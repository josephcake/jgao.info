import { useEffect, useRef } from 'react'

// Under the pointer the ink inside the letters melts into contour rings that match the map behind
// them, the way the sensor on Floor 23 sees through walls.
export default function NameScan() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const h1 = canvas.parentElement
    const ctx = canvas.getContext('2d')
    const make = () => {
      const c = document.createElement('canvas')
      return [c, c.getContext('2d')]
    }
    const [solid, sctx] = make()
    const [rings, rctx] = make()
    const [layer, lctx] = make()
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, k: 0, target: 0, until: 0 }
    let W = 0
    let H = 0
    let pad = 0
    let size = 0
    let dpr = 1
    let box = { x0: 0, x1: 0, y0: 0, y1: 0 }
    let colors = { ink: '#000', signal: '#00f', contour: '#888', strong: '#666' }
    let raf = 0
    let ready = false

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement)
      const v = (name) => cs.getPropertyValue(name).trim()
      colors = {
        ink: v('--ink'),
        signal: v('--signal'),
        contour: v('--contour'),
        strong: v('--contour-strong'),
      }
    }

    // Each letter in its own style, so the italic word is drawn italic
    const setFont = (g, el) => {
      const cs = getComputedStyle(el)
      g.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`
    }

    // The canvas only takes over when its glyphs match the page's, so a browser that draws the face
    // differently keeps the plain letters
    const matches = () => {
      const spacing = parseFloat(getComputedStyle(h1).letterSpacing) || 0
      return [...h1.querySelectorAll('.hero__char')].every((el) => {
        setFont(sctx, el)
        return Math.abs(sctx.measureText(el.textContent).width + spacing - el.offsetWidth) < size * 0.06
      })
    }

    const glyphs = (g, paint) => {
      g.textBaseline = 'alphabetic'
      g.lineJoin = 'round'
      h1.querySelectorAll('.hero__char').forEach((el) => {
        setFont(g, el)
        const m = g.measureText(el.textContent)
        const a = m.fontBoundingBoxAscent
        paint(
          el.textContent,
          el.offsetLeft + pad,
          el.offsetTop + (el.offsetHeight - a - m.fontBoundingBoxDescent) / 2 + a + pad,
        )
      })
    }

    const paint = () => {
      for (const g of [sctx, rctx]) {
        g.setTransform(dpr, 0, 0, dpr, 0, 0)
        g.clearRect(0, 0, W, H)
      }
      sctx.fillStyle = colors.ink
      glyphs(sctx, (c, x, y) => sctx.fillText(c, x, y))

      // The letters as a hill: rings either side of every glyph edge, widest first so each ring
      // cuts the ones inside it
      const gap = size * 0.05
      for (let i = 4; i >= 0; i--) {
        rctx.globalCompositeOperation = 'source-over'
        rctx.strokeStyle = i === 0 ? colors.strong : colors.contour
        rctx.lineWidth = i * gap * 2 + 1.2
        glyphs(rctx, (c, x, y) => rctx.strokeText(c, x, y))
        if (i > 0) {
          rctx.globalCompositeOperation = 'destination-out'
          rctx.lineWidth = i * gap * 2 - 1
          glyphs(rctx, (c, x, y) => rctx.strokeText(c, x, y))
        }
      }
      rctx.globalCompositeOperation = 'source-over'
    }

    const build = () => {
      size = parseFloat(getComputedStyle(h1).fontSize)
      pad = Math.round(size * 0.35)
      W = h1.offsetWidth + pad * 2
      H = h1.offsetHeight + pad * 2
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      for (const c of [canvas, solid, rings, layer]) {
        c.width = Math.round(W * dpr)
        c.height = Math.round(H * dpr)
      }
      Object.assign(canvas.style, { left: `${-pad}px`, top: `${-pad}px`, width: `${W}px`, height: `${H}px` })
      box = { x0: Infinity, x1: 0, y0: Infinity, y1: 0 }
      h1.querySelectorAll('.hero__char').forEach((el) => {
        box.x0 = Math.min(box.x0, el.offsetLeft + pad)
        box.x1 = Math.max(box.x1, el.offsetLeft + el.offsetWidth + pad)
        box.y0 = Math.min(box.y0, el.offsetTop + pad)
        box.y1 = Math.max(box.y1, el.offsetTop + el.offsetHeight + pad)
      })
      readColors()
      paint()
      ready = true
    }

    const draw = (time) => {
      pointer.x += (pointer.tx - pointer.x) * 0.3
      pointer.y += (pointer.ty - pointer.y) * 0.3
      pointer.k += (pointer.target - pointer.k) * 0.1
      const k = pointer.k
      const open = size * 0.5 * (1 - (1 - k) ** 3)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      ctx.drawImage(solid, 0, 0, W, H)

      if (k > 0.01) {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.beginPath()
        ctx.arc(pointer.x, pointer.y, open, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalCompositeOperation = 'source-over'

        lctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        lctx.clearRect(0, 0, W, H)
        lctx.save()
        lctx.beginPath()
        lctx.arc(pointer.x, pointer.y, open, 0, Math.PI * 2)
        lctx.clip()
        lctx.drawImage(rings, 0, 0, W, H)
        const phase = (time / 1500) % 1
        lctx.strokeStyle = colors.signal
        lctx.lineWidth = Math.max(2, size * 0.012)
        lctx.globalAlpha = 0.6 * (1 - phase)
        lctx.beginPath()
        lctx.arc(pointer.x, pointer.y, open * phase, 0, Math.PI * 2)
        lctx.stroke()
        lctx.restore()
        lctx.globalCompositeOperation = 'destination-in'
        lctx.drawImage(solid, 0, 0, W, H)
        lctx.globalCompositeOperation = 'source-over'

        ctx.globalAlpha = k
        ctx.drawImage(layer, 0, 0, W, H)
        ctx.globalAlpha = 1
      }

      return k > 0.004 || pointer.target > 0
    }

    const loop = (time) => {
      if (pointer.until && time > pointer.until) {
        pointer.until = 0
        pointer.target = 0
      }
      raf = draw(time) ? requestAnimationFrame(loop) : 0
    }
    const wake = () => {
      if (ready && !raf) raf = requestAnimationFrame(loop)
    }

    const locate = (e) => {
      const rect = canvas.getBoundingClientRect()
      const s = W / rect.width
      return [(e.clientX - rect.left) * s, (e.clientY - rect.top) * s]
    }
    const onText = (x, y) => x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1
    const onMove = (e) => {
      if (e.pointerType !== 'mouse' || !ready) return
      const [x, y] = locate(e)
      const inside = onText(x, y) && window.scrollY < innerHeight * 0.3
      if (inside && pointer.target === 0 && pointer.k < 0.02) {
        pointer.x = x
        pointer.y = y
      }
      pointer.tx = x
      pointer.ty = y
      pointer.target = inside ? 1 : 0
      wake()
    }
    const onDown = (e) => {
      if (e.pointerType === 'mouse' || !ready) return
      const [x, y] = locate(e)
      if (!onText(x, y)) return
      pointer.x = pointer.tx = x
      pointer.y = pointer.ty = y
      pointer.target = 1
      pointer.until = performance.now() + 1400
      wake()
    }
    const onLeave = () => {
      pointer.target = 0
      wake()
    }

    let alive = true
    document.fonts.ready.then(() => {
      size = parseFloat(getComputedStyle(h1).fontSize)
      if (!alive || !matches()) return
      build()
      h1.classList.add('hero__name--scan')
      wake()
    })
    const resized = new ResizeObserver(() => {
      if (!ready || (h1.offsetWidth + pad * 2 === W && h1.offsetHeight + pad * 2 === H)) return
      build()
      wake()
    })
    resized.observe(h1)
    const themed = new MutationObserver(() => {
      if (!ready) return
      readColors()
      paint()
      wake()
    })
    themed.observe(document.documentElement, { attributes: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    h1.addEventListener('pointerdown', onDown)
    document.documentElement.addEventListener('pointerleave', onLeave)

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      resized.disconnect()
      themed.disconnect()
      window.removeEventListener('pointermove', onMove)
      h1.removeEventListener('pointerdown', onDown)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      h1.classList.remove('hero__name--scan')
    }
  }, [])

  return <canvas className="hero__scan" ref={ref} aria-hidden="true" />
}
