'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  DIAMOND_CEREMONY_END,
  DIAMOND_CEREMONY_START,
} from '@/lib/membership/unlock-sequence'

const ease = {
  outExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  outQuart: t => 1 - Math.pow(1 - t, 4),
  inOutQuart: t => t < 0.5 ? 8*t*t*t*t : 1-Math.pow(-2*t+2,4)/2,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2,
  inExpo: t => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
  inOutExpo: t => t === 0 ? 0 : t === 1 ? 1 :
    t < 0.5 ? Math.pow(2, 20*t-10)/2 : (2-Math.pow(2,-20*t+10))/2,
  outElastic: t => {
    const c4 = (2*Math.PI)/3
    return t===0?0:t===1?1:Math.pow(2,-10*t)*Math.sin((t*10-0.75)*c4)+1
  },
  inQuart: t => t*t*t*t,
  inCubic: t => t*t*t,
  linear: t => t,
}

function animateValue(duration, onUpdate, easingFn) {
  const fn = easingFn || ease.inOutCubic
  return new Promise(resolve => {
    const start = performance.now()
    function frame(now) {
      const raw = Math.min((now - start) / duration, 1)
      onUpdate(fn(raw), raw)
      if (raw < 1) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function createDiamondEngine(canvas) {
  const ctx = canvas.getContext('2d')
  let W = canvas.width = window.innerWidth
  let H = canvas.height = window.innerHeight
  let running = true
  let rafId = null

  let state = {
    diamondScale: 0,
    diamondOpacity: 0,
    diamondRotation: 0,
    diamondGlow: 0,
    rayOpacity: 0,
    rayLength: 0,
    innerDiamondScale: 0,
    innerDiamondOpacity: 0,
    innerDiamondRotation: 0,
    particles: [],
    particleOpacity: 0,
    bloomRadius: 0,
    bloomOpacity: 0,
    coreBloom: 0,
    fillProgress: 0,
    fillOpacity: 0,
    rings: [],
    ringOpacity: 0,
    time: 0,
  }

  function initParticles() {
    state.particles = []
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2
      const dist = 60 + Math.random() * 260
      state.particles.push({
        x: W/2 + Math.cos(angle) * dist,
        y: H/2 + Math.sin(angle) * dist,
        baseX: W/2 + Math.cos(angle) * dist,
        baseY: H/2 + Math.sin(angle) * dist,
        targetX: W/2 + Math.cos(angle) * (dist * 0.1),
        targetY: H/2 + Math.sin(angle) * (dist * 0.1),
        size: Math.random() * 1.6 + 0.3,
        opacity: Math.random() * 0.5 + 0.2,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: Math.random() * 0.05 + 0.02,
        angle,
        dist,
        orbitSpeed: (Math.random() - 0.5) * 0.004,
        orbitAngle: angle,
      })
    }
  }

  function initRings() {
    state.rings = [
      { radius: 0, targetRadius: 80,  opacity: 0, width: 0.5 },
      { radius: 0, targetRadius: 130, opacity: 0, width: 0.4 },
      { radius: 0, targetRadius: 190, opacity: 0, width: 0.3 },
    ]
  }

  initParticles()
  initRings()

  function drawDiamond(cx, cy, size, rotation, opacity) {
    if (opacity <= 0 || size <= 0) return
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rotation)
    ctx.globalAlpha = opacity

    const s = size

    if (state.diamondGlow > 0) {
      const glowSize = s * (1 + state.diamondGlow * 1.4)
      const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize)
      grd.addColorStop(0, `rgba(255,255,255,${0.18 * state.diamondGlow})`)
      grd.addColorStop(0.4, `rgba(220,225,255,${0.08 * state.diamondGlow})`)
      grd.addColorStop(1, 'rgba(220,225,255,0)')
      ctx.beginPath()
      ctx.arc(0, 0, glowSize, 0, Math.PI * 2)
      ctx.fillStyle = grd
      ctx.fill()
    }

    const top    = { x: 0,        y: -s }
    const right  = { x: s * 0.55, y: 0 }
    const bottom = { x: 0,        y: s }
    const left   = { x: -s * 0.55, y: 0 }

    const g1 = ctx.createLinearGradient(-s*0.3, -s*0.5, s*0.2, 0)
    g1.addColorStop(0, 'rgba(255,255,255,0.92)')
    g1.addColorStop(0.5, 'rgba(220,225,255,0.75)')
    g1.addColorStop(1, 'rgba(180,185,220,0.6)')

    const g2 = ctx.createLinearGradient(0, -s*0.5, s*0.3, 0)
    g2.addColorStop(0, 'rgba(255,255,255,0.7)')
    g2.addColorStop(1, 'rgba(160,165,200,0.5)')

    const g3 = ctx.createLinearGradient(0, 0, 0, s*0.6)
    g3.addColorStop(0, 'rgba(200,205,240,0.6)')
    g3.addColorStop(1, 'rgba(140,145,190,0.4)')

    const g4 = ctx.createLinearGradient(-s*0.2, 0, 0, s*0.6)
    g4.addColorStop(0, 'rgba(180,185,230,0.5)')
    g4.addColorStop(1, 'rgba(120,125,170,0.35)')

    ctx.beginPath()
    ctx.moveTo(top.x, top.y)
    ctx.lineTo(0, 0)
    ctx.lineTo(left.x, left.y)
    ctx.closePath()
    ctx.fillStyle = g1
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(top.x, top.y)
    ctx.lineTo(right.x, right.y)
    ctx.lineTo(0, 0)
    ctx.closePath()
    ctx.fillStyle = g2
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(right.x, right.y)
    ctx.lineTo(bottom.x, bottom.y)
    ctx.closePath()
    ctx.fillStyle = g3
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(left.x, left.y)
    ctx.lineTo(bottom.x, bottom.y)
    ctx.closePath()
    ctx.fillStyle = g4
    ctx.fill()

    ctx.strokeStyle = `rgba(255,255,255,${0.4 * opacity})`
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(top.x, top.y)
    ctx.lineTo(left.x, left.y)
    ctx.moveTo(top.x, top.y)
    ctx.lineTo(right.x, right.y)
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(0, -s * 0.08, s * 0.06, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,255,${0.9 * opacity})`
    ctx.fill()

    ctx.restore()
  }

  function drawRays(cx, cy, opacity, length) {
    if (opacity <= 0) return
    ctx.save()
    ctx.globalAlpha = opacity
    const rayAngles = [0,45,90,135,180,225,270,315,22.5,67.5,112.5,157.5,202.5,247.5,292.5,337.5]
    rayAngles.forEach((deg, i) => {
      const rad = (deg * Math.PI) / 180
      const isPrimary = i < 8
      const rayLen = length * (isPrimary ? 1 : 0.4)
      const alpha = isPrimary ? 1 : 0.35
      const startDist = isPrimary ? 28 : 18
      const x1 = cx + Math.cos(rad) * startDist
      const y1 = cy + Math.sin(rad) * startDist
      const x2 = cx + Math.cos(rad) * rayLen
      const y2 = cy + Math.sin(rad) * rayLen
      const grd = ctx.createLinearGradient(x1, y1, x2, y2)
      grd.addColorStop(0, `rgba(255,255,255,${0.9 * alpha})`)
      grd.addColorStop(0.3, `rgba(220,225,255,${0.45 * alpha})`)
      grd.addColorStop(1, 'rgba(220,225,255,0)')
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.strokeStyle = grd
      ctx.lineWidth = isPrimary ? 1.4 : 0.5
      ctx.stroke()
    })
    ctx.restore()
  }

  function drawParticles(opacity, convergence) {
    if (opacity <= 0) return
    state.particles.forEach(p => {
      p.orbitAngle += p.orbitSpeed
      p.twinkle += p.twinkleSpeed
      const cx = p.baseX + (p.targetX - p.baseX) * convergence
      const cy = p.baseY + (p.targetY - p.baseY) * convergence
      const x = cx + Math.cos(p.orbitAngle) * (p.dist * 0.025)
      const y = cy + Math.sin(p.orbitAngle) * (p.dist * 0.025)
      const twinkle = 0.6 + 0.4 * Math.sin(p.twinkle)
      const alpha = p.opacity * opacity * twinkle * (1 - convergence * 0.7)
      if (alpha <= 0) return
      const grd = ctx.createRadialGradient(x, y, 0, x, y, p.size * 3)
      grd.addColorStop(0, `rgba(255,255,255,${alpha})`)
      grd.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.beginPath()
      ctx.arc(x, y, p.size * 3, 0, Math.PI * 2)
      ctx.fillStyle = grd
      ctx.fill()
    })
  }

  function drawRings(cx, cy) {
    state.rings.forEach(ring => {
      if (ring.opacity <= 0) return
      ctx.save()
      ctx.globalAlpha = ring.opacity * state.ringOpacity
      ctx.beginPath()
      ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255,255,255,${0.22 * ring.opacity})`
      ctx.lineWidth = ring.width
      ctx.stroke()
      ctx.restore()
    })
  }

  function drawBloom(cx, cy) {
    if (state.bloomOpacity > 0) {
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, state.bloomRadius)
      grd.addColorStop(0, `rgba(255,255,255,${0.35 * state.bloomOpacity})`)
      grd.addColorStop(0.2, `rgba(240,242,255,${0.18 * state.bloomOpacity})`)
      grd.addColorStop(0.5, `rgba(220,225,255,${0.07 * state.bloomOpacity})`)
      grd.addColorStop(1, 'rgba(220,225,255,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, state.bloomRadius, 0, Math.PI * 2)
      ctx.fillStyle = grd
      ctx.fill()
    }
    if (state.coreBloom > 0) {
      const coreSize = 8 + state.coreBloom * 38
      const grd2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreSize)
      grd2.addColorStop(0, `rgba(255,255,255,${state.coreBloom})`)
      grd2.addColorStop(0.3, `rgba(255,255,255,${state.coreBloom * 0.55})`)
      grd2.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, coreSize, 0, Math.PI * 2)
      ctx.fillStyle = grd2
      ctx.fill()
    }
  }

  function drawFill(cx, cy) {
    if (state.fillProgress <= 0) return
    const maxR = Math.sqrt(W*W + H*H)
    const r = state.fillProgress * maxR
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    grd.addColorStop(0, `rgba(6,6,6,${state.fillOpacity})`)
    grd.addColorStop(0.4, `rgba(6,6,6,${state.fillOpacity * 0.98})`)
    grd.addColorStop(0.7, `rgba(6,6,6,${state.fillOpacity * 0.96})`)
    grd.addColorStop(1, `rgba(6,6,6,${state.fillOpacity * 0.92})`)
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = grd
    ctx.fill()
  }

  function draw(timestamp) {
    if (!running) return
    state.time = timestamp
    ctx.clearRect(0, 0, W, H)
    const cx = W / 2
    const cy = H / 2

    ctx.fillStyle = '#06060a'
    ctx.fillRect(0, 0, W, H)

    const vig = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7)
    vig.addColorStop(0, 'rgba(0,0,0,0)')
    vig.addColorStop(1, 'rgba(0,0,0,0.65)')
    ctx.fillStyle = vig
    ctx.fillRect(0, 0, W, H)

    const convergence = Math.max(0, (state.diamondScale - 0.2) / 0.8)
    drawParticles(state.particleOpacity, convergence)
    drawRings(cx, cy)
    drawBloom(cx, cy)

    const rayLen = state.rayLength * Math.min(W, H) * 0.6
    drawRays(cx, cy, state.rayOpacity, rayLen)

    if (state.innerDiamondOpacity > 0) {
      const offsets = [
        { angle: state.innerDiamondRotation * 1.4,                  dist: 50, size: 7 },
        { angle: state.innerDiamondRotation * 1.4 + Math.PI * 0.5,  dist: 50, size: 7 },
        { angle: state.innerDiamondRotation * 1.4 + Math.PI,        dist: 50, size: 7 },
        { angle: state.innerDiamondRotation * 1.4 + Math.PI * 1.5,  dist: 50, size: 7 },
        { angle: state.innerDiamondRotation * 0.8 + Math.PI * 0.25, dist: 78, size: 4 },
        { angle: state.innerDiamondRotation * 0.8 + Math.PI * 0.75, dist: 78, size: 4 },
        { angle: state.innerDiamondRotation * 0.8 + Math.PI * 1.25, dist: 78, size: 4 },
        { angle: state.innerDiamondRotation * 0.8 + Math.PI * 1.75, dist: 78, size: 4 },
      ]
      offsets.forEach(o => {
        drawDiamond(
          cx + Math.cos(o.angle) * o.dist * state.innerDiamondScale,
          cy + Math.sin(o.angle) * o.dist * state.innerDiamondScale,
          o.size * state.innerDiamondScale,
          o.angle + Math.PI / 4,
          state.innerDiamondOpacity
        )
      })
    }

    const mainSize = state.diamondScale * Math.min(W, H) * 0.22
    drawDiamond(cx, cy, mainSize, state.diamondRotation, state.diamondOpacity)
    drawFill(cx, cy)

    rafId = requestAnimationFrame(draw)
  }

  rafId = requestAnimationFrame(draw)

  window.addEventListener('resize', () => {
    W = canvas.width = window.innerWidth
    H = canvas.height = window.innerHeight
    initParticles()
  })

  return {
    state,
    destroy() {
      running = false
      if (rafId) cancelAnimationFrame(rafId)
    }
  }
}

export default function DiamondCeremony({ onComplete }) {
  const canvasRef   = useRef(null)
  const overlayRef  = useRef(null)
  const welcomeRef  = useRef(null)
  const engineRef   = useRef(null)
  const hasCompleted = useRef(false)
  const skippable   = useRef(false)

  const eyebrowRef  = useRef(null)
  const headlineRef = useRef(null)
  const taglineRef  = useRef(null)
  const dividerRef  = useRef(null)
  const ben1Ref     = useRef(null)
  const ben2Ref     = useRef(null)
  const ben3Ref     = useRef(null)
  const ben4Ref     = useRef(null)
  const ben5Ref     = useRef(null)
  const emblemRef   = useRef(null)
  const finalRef    = useRef(null)

  const [phase, setPhase] = useState('ceremony')

  const completeCeremony = useCallback(() => {
    if (hasCompleted.current) return
    hasCompleted.current = true
    if (engineRef.current) engineRef.current.destroy()
    animateValue(600, t => {
      if (overlayRef.current) overlayRef.current.style.opacity = (1 - t).toString()
    }, ease.inOutCubic).then(() => {
      window.dispatchEvent(new Event(DIAMOND_CEREMONY_END))
      setPhase('done')
      if (onComplete) onComplete()
    })
  }, [onComplete])

  useEffect(() => {
    window.dispatchEvent(new Event(DIAMOND_CEREMONY_START))
    return () => {
      window.dispatchEvent(new Event(DIAMOND_CEREMONY_END))
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { skippable.current = true }, 1800)
    const onClick = () => { if (skippable.current) completeCeremony() }
    const onKey = e => {
      if (skippable.current && ['Escape',' ','Enter'].includes(e.key)) completeCeremony()
    }
    const el = overlayRef.current
    el?.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      el?.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [completeCeremony])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      completeCeremony()
    }
  }, [completeCeremony])

  useEffect(() => {
    if (phase !== 'ceremony') return
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = createDiamondEngine(canvas)
    engineRef.current = engine
    const s = engine.state

    async function runSequence() {

      // ── ACT 1: PARTICLES + DIAMOND BIRTH (0–0.8s) ──
      animateValue(600, t => {
        s.particleOpacity = ease.outCubic(t) * 0.65
      })

      animateValue(700, t => {
        s.diamondScale   = ease.outElastic(t) * 0.065
        s.diamondOpacity = Math.min(t * 3, 1)
        s.diamondGlow    = ease.outCubic(t) * 0.5
      })

      await wait(500)

      // ── ACT 2: RINGS + ORBITS + RAYS (0.5–1.6s) ──
      animateValue(600, t => {
        s.ringOpacity = ease.outCubic(t) * 0.55
        s.rings.forEach((ring, i) => {
          const delay = i * 0.18
          const rt = Math.max(0, (t - delay) / (1 - delay))
          ring.radius  = ease.outExpo(rt) * ring.targetRadius
          ring.opacity = Math.min(rt * 3, 1) * (1 - i * 0.2)
        })
      })

      animateValue(700, t => {
        s.innerDiamondOpacity = ease.outCubic(t) * 0.5
        s.innerDiamondScale   = ease.outElastic(t)
      })

      animateValue(700, t => {
        s.rayOpacity = ease.outCubic(t) * 0.6
        s.rayLength  = ease.outExpo(t)
      })

      // Rotation loop
      let rotRaf = null
      const rotStart = performance.now()
      const rotate = now => {
        const el = (now - rotStart) / 1000
        s.innerDiamondRotation = el * 0.5
        s.diamondRotation      = el * 0.09
        rotRaf = requestAnimationFrame(rotate)
      }
      rotRaf = requestAnimationFrame(rotate)

      animateValue(500, t => {
        s.bloomRadius  = 50 + ease.outCubic(t) * 160
        s.bloomOpacity = ease.outCubic(t) * 0.45
        s.coreBloom    = ease.outCubic(t) * 0.35
      })

      await wait(700)

      // ── ACT 3: CHARGE (1.6–2.2s) ──
      animateValue(500, t => {
        s.diamondGlow  = 0.5 + ease.inExpo(t) * 2.2
        s.coreBloom    = 0.35 + ease.inExpo(t) * 1.4
        s.bloomOpacity = 0.45 + ease.inExpo(t) * 0.55
        s.bloomRadius  = 210 + ease.inExpo(t) * 220
        s.rayOpacity   = 0.6 + ease.inExpo(t) * 0.4
      })

      await wait(350)

      // ── ACT 4: THE ZOOM (2.2–3.4s) ──
      if (rotRaf) cancelAnimationFrame(rotRaf)

      animateValue(1100, t => {
        // Diamond fills screen
        s.diamondScale   = 0.065 + ease.inOutExpo(t) * 1.9
        s.diamondRotation = s.diamondRotation + t * 0.25

        // Satellites vanish
        s.innerDiamondOpacity = 0.5 * (1 - ease.outCubic(t))
        s.innerDiamondScale   = 1 - ease.inCubic(t) * 0.5

        // Rings fade
        s.ringOpacity = 0.55 * (1 - ease.outCubic(t))

        // Rays flare then vanish
        if (t < 0.35) {
          s.rayOpacity = 1
          s.rayLength  = 1 + ease.outCubic(t / 0.35) * 0.6
        } else {
          const t2 = (t - 0.35) / 0.65
          s.rayOpacity = 1 * (1 - ease.outCubic(t2))
          s.rayLength  = 1.6 * (1 - ease.inCubic(t2) * 0.85)
        }

        // Bloom explodes
        s.bloomRadius  = 430 + ease.inExpo(t) * 650
        s.bloomOpacity = 1 * (1 - ease.inCubic(Math.max(0, t - 0.45) / 0.55))
        s.coreBloom    = 1.8 * (1 - ease.inCubic(Math.max(0, t - 0.25) / 0.75))

        // Particles converge and die
        s.particleOpacity = 0.65 * (1 - ease.outCubic(t))

        // Fill begins at 55%
        if (t > 0.5) {
          const ft = (t - 0.5) / 0.5
          s.fillProgress = ease.inExpo(ft)
          s.fillOpacity  = ease.outCubic(ft)
        }
      }, ease.linear)

      await wait(150)

      // White flash
      animateValue(350, t => {
        s.fillProgress  = 1
        s.fillOpacity   = Math.min(t * 2.5, 1)
        s.diamondOpacity = 1 - ease.outCubic(t)
      }, ease.inQuart)

      await wait(250)

      // ── ACT 5: WELCOME (3.4s+) ──
      if (hasCompleted.current) return
      setPhase('welcome')

      const fadeIn = (el, dur, targetOpacity = 1) => {
        if (!el) return Promise.resolve()
        el.style.opacity   = '0'
        el.style.transform = 'translateY(10px)'
        return animateValue(dur, t => {
          el.style.opacity   = (ease.outCubic(t) * targetOpacity).toString()
          el.style.transform = `translateY(${10 * (1 - ease.outCubic(t))}px)`
        })
      }

      await wait(250)
      await fadeIn(eyebrowRef.current, 700)
      await wait(150)
      await fadeIn(headlineRef.current, 900)
      await wait(200)
      await fadeIn(taglineRef.current, 650)
      await wait(150)
      await fadeIn(dividerRef.current, 500)
      await wait(150)

      const benefits = [ben1Ref,ben2Ref,ben3Ref,ben4Ref,ben5Ref]
      for (const b of benefits) {
        fadeIn(b.current, 420)
        await wait(90)
      }

      await wait(400)
      await fadeIn(emblemRef.current, 600, 0.35)
      await wait(250)
      await fadeIn(finalRef.current, 1000)
      await wait(2400)

      completeCeremony()
    }

    runSequence()
    return () => { engine.destroy() }
  }, [phase, completeCeremony])

  if (phase === 'done') return null

  return (
    <>
      <style>{`
        .dc-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          overflow: hidden;
          cursor: default;
        }
        .dc-canvas {
          position: absolute;
          inset: 0;
          display: block;
        }
        .dc-welcome {
          position: absolute;
          inset: 0;
          background: #060606;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          opacity: 0;
          transition: opacity 0.7s ease;
          cursor: pointer;
        }
        .dc-welcome.visible {
          opacity: 1;
        }
        .dc-welcome-inner {
          max-width: 540px;
          width: 100%;
          text-align: center;
        }
        .dc-eyebrow {
          font-family: var(--font-geist-sans), system-ui, sans-serif;
          font-weight: 300;
          font-size: 9px;
          letter-spacing: 0.5em;
          color: rgba(201, 184, 150, 0.55);
          text-transform: uppercase;
          margin-bottom: 26px;
          opacity: 0;
          will-change: opacity, transform;
        }
        .dc-headline {
          font-family: var(--font-cormorant), Georgia, serif;
          font-weight: 300;
          font-size: clamp(26px, 4.5vw, 46px);
          color: rgba(245, 242, 235, 0.95);
          line-height: 1.2;
          letter-spacing: 0.01em;
          margin-bottom: 22px;
          opacity: 0;
          will-change: opacity, transform;
        }
        .dc-headline em {
          font-style: italic;
          font-weight: 400;
          color: rgba(245, 242, 235, 0.78);
        }
        .dc-tagline {
          font-family: var(--font-cormorant), Georgia, serif;
          font-weight: 400;
          font-size: clamp(14px, calc(2vw + 1px), 18px);
          font-style: italic;
          color: rgba(245, 242, 235, 0.62);
          margin-bottom: 32px;
          opacity: 0;
          will-change: opacity, transform;
        }
        .dc-divider {
          width: 1px;
          height: 44px;
          background: linear-gradient(180deg, transparent, rgba(245, 242, 235, 0.18), transparent);
          margin: 0 auto 32px;
          opacity: 0;
          will-change: opacity, transform;
        }
        .dc-benefits {
          list-style: none;
          padding: 0;
          margin: 0 0 44px;
          display: flex;
          flex-direction: column;
          gap: 13px;
        }
        .dc-benefit {
          font-family: var(--font-geist-sans), system-ui, sans-serif;
          font-weight: 400;
          font-size: 11px;
          letter-spacing: 0.22em;
          color: rgba(245, 242, 235, 0.68);
          text-transform: uppercase;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 13px;
          opacity: 0;
          will-change: opacity, transform;
        }
        .dc-dot {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: rgba(245, 242, 235, 0.32);
          flex-shrink: 0;
        }
        .dc-emblem {
          font-family: var(--font-cormorant), Georgia, serif;
          font-weight: 400;
          font-size: 10px;
          letter-spacing: 0.6em;
          color: rgba(245, 242, 235, 0.32);
          text-transform: uppercase;
          margin-bottom: 18px;
          opacity: 0;
          will-change: opacity, transform;
        }
        .dc-final {
          font-family: var(--font-cormorant), Georgia, serif;
          font-weight: 400;
          font-size: clamp(23px, calc(3.5vw + 1px), 35px);
          font-style: italic;
          color: rgba(245, 242, 235, 0.82);
          letter-spacing: 0.06em;
          opacity: 0;
          will-change: opacity, transform;
        }
        .dc-skip {
          position: absolute;
          bottom: 26px;
          left: 50%;
          transform: translateX(-50%);
          font-family: var(--font-geist-sans), system-ui, sans-serif;
          font-weight: 300;
          font-size: 8px;
          letter-spacing: 0.4em;
          color: rgba(245, 242, 235, 0.18);
          text-transform: uppercase;
          white-space: nowrap;
          pointer-events: none;
          z-index: 10;
        }
      `}</style>

      <div ref={overlayRef} className="dc-overlay">
        <canvas ref={canvasRef} className="dc-canvas" />

        <div
          ref={welcomeRef}
          className={`dc-welcome ${phase === 'welcome' ? 'visible' : ''}`}
          onClick={() => { if (skippable.current) completeCeremony() }}
        >
          <div className="dc-welcome-inner">
            <p ref={eyebrowRef} className="dc-eyebrow">
              HomeAtlas · Private Membership
            </p>
            <h1 ref={headlineRef} className="dc-headline">
              Welcome to Your<br />
              <em>Personalized Home Care</em><br />
              Membership
            </h1>
            <p ref={taglineRef} className="dc-tagline">
              Your home now has a guardian.
            </p>
            <div ref={dividerRef} className="dc-divider" />
            <ul className="dc-benefits">
              {[
                [ben1Ref, 'Priority Scheduling'],
                [ben2Ref, 'Premium Member Pricing'],
                [ben3Ref, 'Complimentary Rain Guarantee'],
                [ben4Ref, 'Dedicated Home History'],
                [ben5Ref, 'Personalized Maintenance Timeline'],
              ].map(([ref, label]) => (
                <li key={label} ref={ref} className="dc-benefit">
                  <span className="dc-dot" />
                  {label}
                  <span className="dc-dot" />
                </li>
              ))}
            </ul>
            <p ref={emblemRef} className="dc-emblem">HomeAtlas</p>
            <p ref={finalRef} className="dc-final">Welcome Home.</p>
          </div>
        </div>

        <p className="dc-skip">
          Tap anywhere to continue
        </p>
      </div>
    </>
  )
}
