"use client";

import { useEffect, useRef, type RefObject } from "react";
import { apolloEase, type ApolloParticlePhase } from "@/lib/membership/unlock-apollo";

export interface ParticleAnimState {
  phase: ApolloParticlePhase;
  constellationProgress: number;
  orbitOpacity: number;
  illuminateProgress: number;
  running: boolean;
}

interface AmbientParticle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speedX: number;
  speedY: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

interface ConstellationParticle {
  x: number;
  y: number;
  tx: number;
  ty: number;
  size: number;
  opacity: number;
}

interface OrbitParticle {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  opacity: number;
  cx: number;
  cy: number;
  yOffset: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
}

interface UnlockParticleCanvasProps {
  animStateRef: RefObject<ParticleAnimState>;
}

export function UnlockParticleCanvas({ animStateRef }: UnlockParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<AmbientParticle[]>([]);
  const constellationRef = useRef<ConstellationParticle[]>([]);
  const orbitRef = useRef<OrbitParticle[]>([]);
  const sparksRef = useRef<Spark[]>([]);
  const lastSparkRef = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      canvasEl.width = window.innerWidth;
      canvasEl.height = window.innerHeight;
      createAmbient();
      createConstellation();
      createOrbit();
    }

    function createAmbient() {
      const count = Math.floor((canvasEl.width * canvasEl.height) / 18_000);
      particlesRef.current = [];
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x: Math.random() * canvasEl.width,
          y: Math.random() * canvasEl.height,
          size: Math.random() * 1.2 + 0.2,
          opacity: Math.random() * 0.15 + 0.02,
          speedX: (Math.random() - 0.5) * 0.12,
          speedY: (Math.random() - 0.5) * 0.12,
          twinkleSpeed: Math.random() * 0.008 + 0.003,
          twinkleOffset: Math.random() * Math.PI * 2,
        });
      }
    }

    function createConstellation() {
      const cx = canvasEl.width / 2;
      const cy = canvasEl.height / 2;
      const keyPoints: Array<{ tx: number; ty: number }> = [];

      for (let a = 0; a < Math.PI * 2; a += 0.25) {
        keyPoints.push({
          tx: cx + Math.cos(a) * 44,
          ty: cy - 80 + Math.sin(a) * 44,
        });
      }

      for (let i = 0; i < 12; i++) {
        keyPoints.push({
          tx: cx + (Math.random() - 0.5) * 12,
          ty: cy - 20 + i * 14,
        });
      }

      [[20, 80], [16, 104], [22, 126]].forEach(([w, yOff]) => {
        keyPoints.push({ tx: cx + 8 + w / 2, ty: cy + yOff });
      });

      constellationRef.current = keyPoints.map((pt) => {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 200 + 80;
        return {
          x: pt.tx + Math.cos(angle) * dist,
          y: pt.ty + Math.sin(angle) * dist,
          tx: pt.tx,
          ty: pt.ty,
          size: Math.random() * 1.5 + 0.5,
          opacity: 0,
        };
      });
    }

    function createOrbit() {
      const cx = canvasEl.width / 2;
      const cy = canvasEl.height / 2;
      orbitRef.current = [];
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2;
        orbitRef.current.push({
          angle,
          radius: 70 + Math.random() * 40,
          speed: (Math.random() * 0.004 + 0.002) * (Math.random() > 0.5 ? 1 : -1),
          size: Math.random() * 1.2 + 0.3,
          opacity: 0,
          cx,
          cy,
          yOffset: (Math.random() - 0.5) * 30,
        });
      }
    }

    function emitSpark(cx: number, cy: number) {
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 1.5 + 0.5;
        sparksRef.current.push({
          x: cx + (Math.random() - 0.5) * 60,
          y: cy - 40 + (Math.random() - 0.5) * 120,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: Math.random() * 0.04 + 0.02,
          size: Math.random() * 1.5 + 0.5,
        });
      }
    }

    resize();
    window.addEventListener("resize", resize);

    const canvasEl = canvas;
    const context = ctx;

    function draw(timestamp: number) {
      frameRef.current = requestAnimationFrame(draw);

      const state = animStateRef.current;
      if (!state?.running) return;

      context.clearRect(0, 0, canvasEl.width, canvasEl.height);
      const cx = canvasEl.width / 2;
      const cy = canvasEl.height / 2;

      particlesRef.current.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0) p.x = canvasEl.width;
        if (p.x > canvasEl.width) p.x = 0;
        if (p.y < 0) p.y = canvasEl.height;
        if (p.y > canvasEl.height) p.y = 0;

        const twinkle = Math.sin(timestamp * p.twinkleSpeed + p.twinkleOffset);
        const alpha = p.opacity * (0.7 + 0.3 * twinkle);

        context.beginPath();
        context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        context.fillStyle = `rgba(200,200,220,${alpha})`;
        context.fill();
      });

      const showConstellation =
        state.phase === "constellation" ||
        state.phase === "orbit" ||
        state.phase === "illuminate";

      if (showConstellation) {
        constellationRef.current.forEach((p) => {
          if (state.constellationProgress > 0) {
            const t = apolloEase.outExpo(Math.min(state.constellationProgress, 1));
            p.x += (p.tx - p.x) * t * 0.06;
            p.y += (p.ty - p.y) * t * 0.06;
            p.opacity = Math.min(state.constellationProgress * 2, 0.7);
          }

          if (p.opacity > 0) {
            const grd = context.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
            grd.addColorStop(0, `rgba(220,220,240,${p.opacity})`);
            grd.addColorStop(1, "rgba(220,220,240,0)");
            context.beginPath();
            context.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
            context.fillStyle = grd;
            context.fill();
          }
        });
      }

      if (state.phase === "orbit" || state.phase === "illuminate") {
        orbitRef.current.forEach((p) => {
          p.angle += p.speed;
          const x = p.cx + Math.cos(p.angle) * p.radius;
          const y = p.cy - 20 + Math.sin(p.angle) * (p.radius * 0.3) + p.yOffset;

          if (p.opacity < state.orbitOpacity) p.opacity += 0.01;

          const illuminateBoost = state.illuminateProgress * 0.5;
          const alpha = p.opacity * (0.4 + illuminateBoost);

          context.beginPath();
          context.arc(x, y, p.size, 0, Math.PI * 2);
          context.fillStyle = `rgba(255,255,255,${alpha})`;
          context.fill();
        });

        if (timestamp - lastSparkRef.current > 400) {
          emitSpark(cx, cy);
          lastSparkRef.current = timestamp;
        }
      }

      sparksRef.current = sparksRef.current.filter((s) => s.life > 0);
      sparksRef.current.forEach((s) => {
        s.x += s.vx;
        s.y += s.vy;
        s.life -= s.decay;
        s.vy -= 0.02;

        if (s.life > 0) {
          context.beginPath();
          context.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
          context.fillStyle = `rgba(255,255,255,${s.life * 0.8})`;
          context.fill();
        }
      });
    }

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, [animStateRef]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[2]"
      aria-hidden
    />
  );
}
