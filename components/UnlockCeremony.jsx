'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// ============================================
// EASING FUNCTIONS
// ============================================
const ease = {
  outExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  outQuart: t => 1 - Math.pow(1 - t, 4),
  inOutQuart: t => t < 0.5 ? 8*t*t*t*t : 1-Math.pow(-2*t+2,4)/2,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2,
  outElasticSoft: t => {
    const c4 = (2 * Math.PI) / 6
    return t === 0 ? 0 : t === 1 ? 1 :
      Math.pow(2, -8 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
  },
  inQuart: t => t * t * t * t,
}

// ============================================
// ANIMATION HELPERS
// ============================================
function animateValue(duration, onUpdate, easingFn = ease.inOutCubic) {
  return new Promise(resolve => {
    const start = performance.now()
    function frame(now) {
      const raw = Math.min((now - start) / duration, 1)
      const t = easingFn(raw)
      onUpdate(t, raw)
      if (raw < 1) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================
// COMPONENT
// ============================================
export default function UnlockCeremony({ onComplete }) {
  const canvasRef = useRef(null)
  const ceremonyRef = useRef(null)
  const keyWrapperRef = useRef(null)
  const lockWrapperRef = useRef(null)
  const bloomCoreRef = useRef(null)
  const bloomFillRef = useRef(null)
  const whiteFlashRef = useRef(null)
  const welcomeContentRef = useRef(null)
  const skipHintRef = useRef(null)
  const animRunning = useRef(true)
  const skippable = useRef(false)
  const hasCompleted = useRef(false)

  // Welcome element refs
  const eyebrowRef = useRef(null)
  const headlineRef = useRef(null)
  const sub1Ref = useRef(null)
  const sub2Ref = useRef(null)
  const sub3Ref = useRef(null)
  const dividerRef = useRef(null)
  const ben1Ref = useRef(null)
  const ben2Ref = useRef(null)
  const ben3Ref = useRef(null)
  const ben4Ref = useRef(null)
  const ben5Ref = useRef(null)
  const emblemRef = useRef(null)
  const finalRef = useRef(null)
  const ring1Ref = useRef(null)
  const ring2Ref = useRef(null)
  const ring3Ref = useRef(null)

  const [visible, setVisible] = useState(true)

  // ── COMPLETE CEREMONY ──────────────────────
  const completeCeremony = useCallback(() => {
    if (hasCompleted.current) return
    hasCompleted.current = true
    animRunning.current = false

    const ceremony = ceremonyRef.current
    if (!ceremony) return

    animateValue(800, t => {
      ceremony.style.opacity = (1 - t).toString()
    }, ease.inOutCubic).then(() => {
      setVisible(false)
      if (onComplete) onComplete()
    })
  }, [onComplete])

  // ── SKIP HANDLER ───────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => { skippable.current = true }, 2000)

    const handleClick = () => { if (skippable.current) completeCeremony() }
    const handleKey = (e) => {
      if (skippable.current && ['Escape',' ','Enter'].includes(e.key)) {
        completeCeremony()
      }
    }

    const el = ceremonyRef.current
    el?.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKey)

    return () => {
      clearTimeout(timer)
      el?.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [completeCeremony])

  // ── REDUCED MOTION ─────────────────────────
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      completeCeremony()
    }
  }, [completeCeremony])

  // ── PARTICLE SYSTEM ────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let particles = []
    let constellationParticles = []
    let orbitParticles = []
    let sparks = []
    let constellationProgress = 0
    let orbitOpacity = 0
    let illuminateProgress = 0
    let lastSparkTime = 0
    let particlePhase = 'ambient'
    let rafId = null

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Ambient
    function createAmbient() {
      particles = []
      const count = Math.floor((canvas.width * canvas.height) / 18000)
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.2 + 0.2,
          opacity: Math.random() * 0.12 + 0.02,
          speedX: (Math.random() - 0.5) * 0.1,
          speedY: (Math.random() - 0.5) * 0.1,
          twinkleSpeed: Math.random() * 0.006 + 0.002,
          twinkleOffset: Math.random() * Math.PI * 2,
        })
      }
    }

    // Constellation
    function createConstellation() {
      const cx = canvas.width / 2
      const cy = canvas.height / 2
      constellationParticles = []
      const keyPoints = []

      for (let a = 0; a < Math.PI * 2; a += 0.22) {
        keyPoints.push({
          tx: cx + Math.cos(a) * 44,
          ty: cy - 80 + Math.sin(a) * 44
        })
      }
      for (let i = 0; i < 14; i++) {
        keyPoints.push({
          tx: cx + (Math.random() - 0.5) * 10,
          ty: cy - 18 + i * 13
        })
      }
      [[20, 80],[14, 104],[22, 126]].forEach(([w, yOff]) => {
        keyPoints.push({ tx: cx + 8 + w / 2, ty: cy + yOff })
      })

      keyPoints.forEach(pt => {
        const angle = Math.random() * Math.PI * 2
        const dist = Math.random() * 180 + 80
        constellationParticles.push({
          x: pt.tx + Math.cos(angle) * dist,
          y: pt.ty + Math.sin(angle) * dist,
          tx: pt.tx,
          ty: pt.ty,
          size: Math.random() * 1.4 + 0.4,
          opacity: 0,
        })
      })
    }

    // Orbit
    function createOrbit() {
      const cx = canvas.width / 2
      const cy = canvas.height / 2
      orbitParticles = []
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2
        orbitParticles.push({
          angle,
          radius: 70 + Math.random() * 40,
          speed: (Math.random() * 0.004 + 0.002) * (Math.random() > 0.5 ? 1 : -1),
          size: Math.random() * 1.2 + 0.3,
          opacity: 0,
          cx, cy,
          yOffset: (Math.random() - 0.5) * 30
        })
      }
    }

    function emitSpark(cx, cy) {
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = Math.random() * 1.4 + 0.4
        sparks.push({
          x: cx + (Math.random() - 0.5) * 60,
          y: cy - 40 + (Math.random() - 0.5) * 120,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: Math.random() * 0.04 + 0.02,
          size: Math.random() * 1.4 + 0.4
        })
      }
    }

    function draw(timestamp) {
      if (!animRunning.current) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        return
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const cx = canvas.width / 2
      const cy = canvas.height / 2

      // Ambient
      particles.forEach(p => {
        p.x += p.speedX
        p.y += p.speedY
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0
        const twinkle = Math.sin(timestamp * p.twinkleSpeed + p.twinkleOffset)
        const alpha = p.opacity * (0.7 + 0.3 * twinkle)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200,200,220,${alpha})`
        ctx.fill()
      })

      // Constellation
      if (['constellation','orbit','illuminate'].includes(particlePhase)) {
        constellationParticles.forEach(p => {
          if (constellationProgress > 0) {
            const t = ease.outExpo(Math.min(constellationProgress, 1))
            p.x += (p.tx - p.x) * t * 0.055
            p.y += (p.ty - p.y) * t * 0.055
            p.opacity = Math.min(constellationProgress * 2, 0.65)
          }
          if (p.opacity > 0) {
            const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3)
            grd.addColorStop(0, `rgba(220,220,240,${p.opacity})`)
            grd.addColorStop(1, `rgba(220,220,240,0)`)
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2)
            ctx.fillStyle = grd
            ctx.fill()
          }
        })
      }

      // Orbit
      if (['orbit','illuminate'].includes(particlePhase)) {
        orbitParticles.forEach(p => {
          p.angle += p.speed
          const x = p.cx + Math.cos(p.angle) * p.radius
          const y = p.cy - 20 + Math.sin(p.angle) * (p.radius * 0.28) + p.yOffset
          if (p.opacity < orbitOpacity) p.opacity += 0.008
          const alpha = p.opacity * (0.4 + illuminateProgress * 0.5)
          ctx.beginPath()
          ctx.arc(x, y, p.size, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,255,255,${alpha})`
          ctx.fill()
        })
      }

      // Sparks
      if (['orbit','illuminate'].includes(particlePhase)) {
        if (timestamp - lastSparkTime > 420) {
          emitSpark(cx, cy)
          lastSparkTime = timestamp
        }
      }
      sparks = sparks.filter(s => s.life > 0)
      sparks.forEach(s => {
        s.x += s.vx
        s.y += s.vy
        s.vy -= 0.018
        s.life -= s.decay
        if (s.life > 0) {
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,255,255,${s.life * 0.8})`
          ctx.fill()
        }
      })

      rafId = requestAnimationFrame(draw)
    }

    createAmbient()
    createConstellation()
    createOrbit()
    rafId = requestAnimationFrame(draw)

    // Expose phase controls to ceremony sequence
    canvas._setPhase = (phase) => { particlePhase = phase }
    canvas._setConstellationProgress = (v) => { constellationProgress = v }
    canvas._setOrbitOpacity = (v) => { orbitOpacity = v }
    canvas._setIlluminateProgress = (v) => { illuminateProgress = v }
    canvas._fadeConstellation = (v) => {
      constellationParticles.forEach(p => { p.opacity = v })
    }

    return () => {
      window.removeEventListener('resize', resize)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  // ── MAIN CEREMONY SEQUENCE ─────────────────
  useEffect(() => {
    if (!visible) return

    async function runCeremony() {
      const canvas = canvasRef.current
      const keyWrapper = keyWrapperRef.current
      const lockWrapper = lockWrapperRef.current
      const bloomCore = bloomCoreRef.current
      const bloomFill = bloomFillRef.current
      const whiteFlash = whiteFlashRef.current
      const welcomeContent = welcomeContentRef.current
      const skipHint = skipHintRef.current

      if (!canvas || !keyWrapper) return

      const setPhase = (p) => canvas._setPhase?.(p)
      const setCP = (v) => canvas._setConstellationProgress?.(v)
      const setOO = (v) => canvas._setOrbitOpacity?.(v)
      const setIP = (v) => canvas._setIlluminateProgress?.(v)
      const fadeConst = (v) => canvas._fadeConstellation?.(v)

      const fadeIn = (el, dur, targetOpacity = 1, easingFn = ease.outCubic) => {
        if (!el) return Promise.resolve()
        el.style.opacity = '0'
        return animateValue(dur, t => {
          el.style.opacity = (t * targetOpacity).toString()
        }, easingFn)
      }

      // ── SCENE 1: DARKNESS ──────────────────
      await wait(600)

      // ── SCENE 2: CONSTELLATION ─────────────
      setPhase('constellation')
      animateValue(1200, t => setCP(t), ease.outExpo)
      await wait(900)

      // Key emerges
      keyWrapper.style.opacity = '0'
      keyWrapper.style.transform = 'translateY(-40px) rotateX(15deg) rotateZ(-8deg) scale(0.6)'

      animateValue(1800, t => {
        const y = -40 + 40 * ease.outElasticSoft(t)
        const rotX = 15 - 15 * ease.outCubic(t)
        const rotZ = -8 + 8 * ease.outCubic(t) + Math.sin(t * Math.PI * 3) * 3 * (1 - t)
        const rotY = Math.sin(t * Math.PI * 1.5) * 25 * (1 - t)
        const scale = 0.6 + 0.4 * ease.outCubic(t)
        keyWrapper.style.opacity = Math.min(t * 3, 1).toString()
        keyWrapper.style.transform =
          `translateY(${y}px) rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg) scale(${scale})`
        if (t > 0.5) fadeConst(0.7 * (1 - (t - 0.5) * 2))
      }, ease.outExpo)

      await wait(700)

      // ── SCENE 3: ORBIT + SPARKS ────────────
      setPhase('orbit')
      animateValue(800, t => setOO(t * 0.6), ease.outCubic)

      let breathingActive = true
      const breatheKey = () => {
        if (!breathingActive) return
        animateValue(2000, t => {
          if (!breathingActive) return
          const glow = 20 + Math.sin(t * Math.PI) * 10
          keyWrapper.style.filter =
            `drop-shadow(0 0 ${glow}px rgba(200,200,220,0.3))`
        }, ease.inOutCubic).then(() => { if (breathingActive) breatheKey() })
      }
      breatheKey()

      await wait(1200)

      // ── SCENE 4: LOCK APPEARS ──────────────
      if (lockWrapper) {
        lockWrapper.style.opacity = '0'
        lockWrapper.style.transform = 'translateX(-50%) scale(0.85)'
        animateValue(600, t => {
          lockWrapper.style.opacity = (t * 0.9).toString()
          const s = 0.85 + 0.15 * ease.outCubic(t)
          lockWrapper.style.transform = `translateX(-50%) scale(${s})`
        }, ease.outCubic)
      }

      await wait(400)

      // Key aligns
      animateValue(900, t => {
        const moveDown = t * 38
        const rotZ = Math.sin(t * Math.PI * 0.5) * 2.5
        keyWrapper.style.transform =
          `translateY(${moveDown}px) rotateZ(${rotZ}deg)`
        keyWrapper.style.filter =
          `drop-shadow(0 0 ${20 + t * 20}px rgba(220,220,255,${0.3 + t * 0.3}))`
      }, ease.outCubic)

      await wait(900)

      // ── SCENE 5: UNLOCK ────────────────────
      breathingActive = false

      animateValue(700, t => {
        const rotZ = t * 90
        keyWrapper.style.transform = `translateY(38px) rotateZ(${rotZ}deg)`
        keyWrapper.style.filter =
          `drop-shadow(0 0 ${40 + t * 60}px rgba(255,255,255,${0.4 + t * 0.6}))`
      }, ease.inOutCubic)

      await wait(500)

      // Fire rings
      const fireRing = (el, delay_ms, maxScale) => {
        if (!el) return
        setTimeout(() => {
          animateValue(1200, t => {
            const s = 1 + t * (maxScale - 1)
            el.style.transform = `translate(-50%, -50%) scale(${s})`
            el.style.opacity = (0.6 * (1 - t)).toString()
          }, ease.outExpo)
        }, delay_ms)
      }

      fireRing(ring1Ref.current, 0, 8)
      fireRing(ring2Ref.current, 200, 12)
      fireRing(ring3Ref.current, 400, 16)

      await wait(300)

      // ── SCENE 6: BLOOM ─────────────────────
      setPhase('illuminate')
      animateValue(400, t => setIP(t), ease.outCubic)

      if (bloomCore) {
        animateValue(600, t => {
          bloomCore.style.opacity = (t * 0.9).toString()
          const size = 4 + t * 8
          bloomCore.style.width = size + 'px'
          bloomCore.style.height = size + 'px'
        }, ease.outCubic)
      }

      await wait(200)

      animateValue(800, t => {
        if (bloomFill) bloomFill.style.opacity = (t * 0.8).toString()
        keyWrapper.style.filter =
          `drop-shadow(0 0 ${60 + t * 40}px rgba(255,255,255,${0.8 + t * 0.2})) brightness(${1 + t * 3})`
        if (lockWrapper) lockWrapper.style.opacity = (0.9 - t * 0.9).toString()
      }, ease.outExpo)

      await wait(400)

      // White flash
      animateValue(400, t => {
        if (whiteFlash) whiteFlash.style.opacity = t.toString()
        keyWrapper.style.opacity = (1 - t).toString()
        if (bloomFill) bloomFill.style.opacity = (0.8 - t * 0.8).toString()
        if (bloomCore) bloomCore.style.opacity = (0.9 - t * 0.9).toString()
      }, ease.inQuart)

      await wait(400)

      // ── SCENE 7: WELCOME ───────────────────
      animRunning.current = false
      if (skipHint) skipHint.style.opacity = '0'
      if (welcomeContent) welcomeContent.style.opacity = '1'

      animateValue(1200, t => {
        if (whiteFlash) whiteFlash.style.opacity = (1 - t * 0.85).toString()
      }, ease.outExpo)

      await wait(400)

      const seq = [
        [eyebrowRef.current, 800],
        [headlineRef.current, 1000, 200],
        [sub1Ref.current, 700, 400],
        [sub2Ref.current, 600, 500],
        [sub3Ref.current, 600, 400],
        [dividerRef.current, 600, 400],
      ]

      for (const [el, dur, delayMs] of seq) {
        await fadeIn(el, dur)
        if (delayMs) await wait(delayMs)
      }

      const benefits = [
        ben1Ref.current,
        ben2Ref.current,
        ben3Ref.current,
        ben4Ref.current,
        ben5Ref.current,
      ]
      for (const ben of benefits) {
        fadeIn(ben, 500)
        await wait(130)
      }

      await wait(400)
      await fadeIn(emblemRef.current, 800)
      await wait(400)
      await fadeIn(finalRef.current, 1000)
      await wait(2200)

      completeCeremony()
    }

    runCeremony()
  }, [visible, completeCeremony])

  if (!visible) return null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Montserrat:wght@200;300;400&display=swap');

        .ha-ceremony {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #060609;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          cursor: pointer;
          font-family: 'Montserrat', sans-serif;
        }
        .ha-ceremony::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.75) 100%);
          z-index: 1;
          pointer-events: none;
        }
        .ha-canvas { position: absolute; inset: 0; z-index: 2; }
        .ha-key-stage {
          position: absolute;
          inset: 0;
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: center;
          perspective: 1200px;
        }
        .ha-key-wrapper {
          position: relative;
          width: 100px;
          height: 240px;
          opacity: 0;
          transform-style: preserve-3d;
          will-change: transform, opacity, filter;
        }
        .ha-lock-wrapper {
          position: absolute;
          width: 72px;
          height: 72px;
          top: calc(50% + 55px);
          left: 50%;
          transform: translateX(-50%);
          opacity: 0;
          will-change: transform, opacity;
        }
        .ha-ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.5);
          opacity: 0;
          top: 50%;
          left: 50%;
          width: 90px;
          height: 90px;
          transform: translate(-50%, -50%) scale(1);
          will-change: transform, opacity;
          z-index: 4;
        }
        .ha-bloom-core {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: white;
          opacity: 0;
          z-index: 5;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          box-shadow:
            0 0 20px 10px rgba(255,255,255,0.8),
            0 0 60px 30px rgba(255,255,255,0.4),
            0 0 120px 60px rgba(255,255,255,0.15);
          will-change: opacity, width, height;
        }
        .ha-bloom-fill {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at center,
            rgba(255,255,255,1) 0%,
            rgba(253,252,250,0.9) 20%,
            rgba(255,255,255,0.5) 50%,
            transparent 80%
          );
          opacity: 0;
          z-index: 6;
          will-change: opacity;
        }
        .ha-white-flash {
          position: absolute;
          inset: 0;
          background: #fdfcfa;
          opacity: 0;
          z-index: 7;
          will-change: opacity;
        }
        .ha-welcome {
          position: absolute;
          inset: 0;
          z-index: 8;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          opacity: 0;
          pointer-events: none;
        }
        .ha-welcome-inner {
          max-width: 540px;
          width: 100%;
          text-align: center;
        }
        .ha-eyebrow {
          font-family: 'Montserrat', sans-serif;
          font-weight: 200;
          font-size: 9px;
          letter-spacing: 0.45em;
          color: rgba(255,255,255,0.3);
          text-transform: uppercase;
          margin-bottom: 22px;
          opacity: 0;
          will-change: opacity;
        }
        .ha-headline {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300;
          font-size: clamp(26px, 4vw, 40px);
          color: rgba(255,255,255,0.95);
          line-height: 1.25;
          letter-spacing: 0.02em;
          margin-bottom: 22px;
          opacity: 0;
          will-change: opacity;
        }
        .ha-headline em {
          font-style: italic;
          font-weight: 400;
        }
        .ha-subtitle {
          font-family: 'Montserrat', sans-serif;
          font-weight: 300;
          font-size: 12px;
          color: rgba(255,255,255,0.55);
          line-height: 1.9;
          letter-spacing: 0.04em;
          margin-bottom: 10px;
          opacity: 0;
          will-change: opacity;
        }
        .ha-statement {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 400;
          font-size: 15px;
          font-style: italic;
          color: rgba(255,255,255,0.45);
          margin-bottom: 8px;
          opacity: 0;
          will-change: opacity;
        }
        .ha-divider {
          width: 36px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
          margin: 28px auto;
          opacity: 0;
          will-change: opacity;
        }
        .ha-benefits {
          list-style: none;
          padding: 0;
          margin: 0 0 36px 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ha-benefit {
          font-family: 'Montserrat', sans-serif;
          font-weight: 300;
          font-size: 10px;
          letter-spacing: 0.15em;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          opacity: 0;
          will-change: opacity;
        }
        .ha-check {
          width: 13px;
          height: 13px;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .ha-check::after {
          content: '';
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: rgba(255,255,255,0.5);
        }
        .ha-emblem {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300;
          font-size: 10px;
          letter-spacing: 0.55em;
          color: rgba(255,255,255,0.2);
          text-transform: uppercase;
          margin-bottom: 18px;
          opacity: 0;
          will-change: opacity;
        }
        .ha-final {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300;
          font-size: clamp(20px, 3vw, 28px);
          font-style: italic;
          color: rgba(255,255,255,0.65);
          letter-spacing: 0.08em;
          opacity: 0;
          will-change: opacity;
        }
        .ha-skip {
          position: absolute;
          bottom: 28px;
          left: 50%;
          transform: translateX(-50%);
          font-family: 'Montserrat', sans-serif;
          font-weight: 200;
          font-size: 9px;
          letter-spacing: 0.35em;
          color: rgba(255,255,255,0.18);
          text-transform: uppercase;
          z-index: 10;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.4s ease;
          white-space: nowrap;
        }
      `}</style>

      <div ref={ceremonyRef} className="ha-ceremony" role="dialog" aria-label="Welcome ceremony">

        <canvas ref={canvasRef} className="ha-canvas" />

        <div className="ha-key-stage">

          {/* KEY */}
          <div ref={keyWrapperRef} className="ha-key-wrapper">
            <svg viewBox="0 0 100 240" fill="none" xmlns="http://www.w3.org/2000/svg"
              style={{ width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="kg1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f0f0f4" />
                  <stop offset="30%" stopColor="#c4c4cc" />
                  <stop offset="60%" stopColor="#e0e0e6" />
                  <stop offset="100%" stopColor="#9c9ca4" />
                </linearGradient>
                <linearGradient id="kg2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="white" stopOpacity="0" />
                  <stop offset="50%" stopColor="white" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </linearGradient>
                <radialGradient id="bowInner" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#18181f" />
                  <stop offset="100%" stopColor="#08080e" />
                </radialGradient>
                <filter id="kg">
                  <feGaussianBlur stdDeviation="1.5" result="b"/>
                  <feComposite in="SourceGraphic" in2="b" operator="over"/>
                </filter>
              </defs>
              {/* Bow */}
              <circle cx="50" cy="46" r="38" fill="url(#kg1)" filter="url(#kg)" />
              <circle cx="50" cy="46" r="38" fill="url(#kg2)" />
              <circle cx="50" cy="46" r="26" fill="url(#bowInner)" />
              {/* Filigree */}
              <circle cx="50" cy="46" r="17" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"/>
              <circle cx="50" cy="46" r="10" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5"/>
              <line x1="50" y1="29" x2="50" y2="63" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5"/>
              <line x1="33" y1="46" x2="67" y2="46" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5"/>
              {/* Shaft */}
              <rect x="43" y="80" width="14" height="138" rx="2.5" fill="url(#kg1)" />
              <rect x="43" y="80" width="14" height="138" rx="2.5" fill="url(#kg2)" />
              {/* Shoulder */}
              <rect x="40" y="75" width="20" height="10" rx="2" fill="url(#kg1)" />
              {/* Teeth */}
              <rect x="57" y="152" width="16" height="7" rx="1.5" fill="url(#kg1)" />
              <rect x="57" y="174" width="12" height="7" rx="1.5" fill="url(#kg1)" />
              <rect x="57" y="196" width="18" height="7" rx="1.5" fill="url(#kg1)" />
              {/* Edge highlight */}
              <rect x="43" y="80" width="2" height="138" rx="1" fill="rgba(255,255,255,0.28)" />
            </svg>
          </div>

          {/* LOCK */}
          <div ref={lockWrapperRef} className="ha-lock-wrapper">
            <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg"
              style={{ width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#d0d0d8" />
                  <stop offset="50%" stopColor="#a4a4ac" />
                  <stop offset="100%" stopColor="#c0c0c8" />
                </linearGradient>
              </defs>
              <rect x="8" y="32" width="56" height="34" rx="5" fill="url(#lg1)" />
              <path d="M20 32 L20 20 Q20 8 36 8 Q52 8 52 20 L52 32"
                stroke="url(#lg1)" strokeWidth="7" fill="none" strokeLinecap="round"/>
              <circle cx="36" cy="48" r="5.5" fill="rgba(0,0,0,0.45)" />
              <rect x="33" y="48" width="6" height="9" rx="1" fill="rgba(0,0,0,0.45)" />
              <rect x="8" y="32" width="56" height="3" rx="1.5" fill="rgba(255,255,255,0.18)" />
            </svg>
          </div>

        </div>

        {/* RINGS */}
        <div ref={ring1Ref} className="ha-ring" />
        <div ref={ring2Ref} className="ha-ring" />
        <div ref={ring3Ref} className="ha-ring" />

        {/* BLOOM */}
        <div ref={bloomCoreRef} className="ha-bloom-core" />
        <div ref={bloomFillRef} className="ha-bloom-fill" />
        <div ref={whiteFlashRef} className="ha-white-flash" />

        {/* WELCOME */}
        <div ref={welcomeContentRef} className="ha-welcome">
          <div className="ha-welcome-inner">

            <p ref={eyebrowRef} className="ha-eyebrow">
              HomeAtlas · Private Membership
            </p>

            <h1 ref={headlineRef} className="ha-headline">
              Welcome to Your<br />
              <em>Personalized Home Care</em><br />
              Membership
            </h1>

            <p ref={sub1Ref} className="ha-subtitle">
              Your home now has a dedicated maintenance plan<br />
              built around your property.
            </p>

            <p ref={sub2Ref} className="ha-statement">
              You&apos;re no longer booking appointments.
            </p>

            <p ref={sub3Ref} className="ha-statement">
              You&apos;re protecting your investment.
            </p>

            <div ref={dividerRef} className="ha-divider" />

            <ul className="ha-benefits">
              {[
                [ben1Ref, 'Priority Scheduling'],
                [ben2Ref, 'Premium Member Pricing'],
                [ben3Ref, 'Complimentary Rain Guarantee'],
                [ben4Ref, 'Dedicated Home History'],
                [ben5Ref, 'Personalized Maintenance Timeline'],
              ].map(([ref, label]) => (
                <li key={label} ref={ref} className="ha-benefit">
                  <span className="ha-check" />
                  {label}
                </li>
              ))}
            </ul>

            <p ref={emblemRef} className="ha-emblem">HomeAtlas</p>

            <p ref={finalRef} className="ha-final">Welcome Home.</p>

          </div>
        </div>

        {/* SKIP */}
        <p ref={skipHintRef} className="ha-skip">Tap anywhere to continue</p>

      </div>
    </>
  )
}
